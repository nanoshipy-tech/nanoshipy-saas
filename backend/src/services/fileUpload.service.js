const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/env');
const logger = require('../utils/logger');

// Dynamically require S3 client to avoid hard crash if not installed/configured yet
let S3Client, PutObjectCommand, DeleteObjectCommand;
try {
  const awsClientS3 = require('@aws-sdk/client-s3');
  S3Client = awsClientS3.S3Client;
  PutObjectCommand = awsClientS3.PutObjectCommand;
  DeleteObjectCommand = awsClientS3.DeleteObjectCommand;
} catch (error) {
  logger.warn('AWS SDK S3 not found. S3/R2 providers will not work.');
}

class FileUploadService {
  constructor() {
    this.provider = config.storage.provider;
    
    if (this.provider === 's3' && S3Client) {
      this.s3Client = new S3Client({
        region: config.storage.s3.region,
        credentials: {
          accessKeyId: config.storage.s3.accessKeyId,
          secretAccessKey: config.storage.s3.secretAccessKey,
        }
      });
      this.bucket = config.storage.s3.bucket;
    } else if (this.provider === 'r2' && S3Client) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${config.storage.r2.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.storage.r2.accessKeyId,
          secretAccessKey: config.storage.r2.secretAccessKey,
        }
      });
      this.bucket = config.storage.r2.bucket;
    } else if (this.provider === 'local') {
      const uploadBasePath = path.join(__dirname, '..', '..', config.storage.uploadDir);
      this.basePaths = {
        'company/documents': path.join(uploadBasePath, 'company', 'documents'),
        'company/logos': path.join(uploadBasePath, 'company', 'logos'),
      };
      // Ensure local directories exist
      for (const dir of Object.values(this.basePaths)) {
        if (!fsSync.existsSync(dir)) {
          fsSync.mkdirSync(dir, { recursive: true });
        }
      }
    }
  }

  /**
   * Upload a file
   * @param {Buffer} buffer - File buffer
   * @param {string} destinationPath - Desired internal path e.g., 'company/documents'
   * @param {string} originalName - Original file name
   * @param {string} mimeType - File mime type
   * @returns {Promise<string>} The public URL or local path
   */
  async uploadFile(buffer, destinationPath, originalName, mimeType) {
    const ext = path.extname(originalName);
    const fileName = `${uuidv4()}-${Date.now()}${ext}`;
    const fullKey = `${destinationPath}/${fileName}`;

    if (this.provider === 'local') {
      const targetDir = this.basePaths[destinationPath] || path.join(__dirname, '..', '..', config.storage.uploadDir, destinationPath);
      if (!fsSync.existsSync(targetDir)) {
         fsSync.mkdirSync(targetDir, { recursive: true });
      }
      const targetPath = path.join(targetDir, fileName);
      await fs.writeFile(targetPath, buffer);
      
      // Return public URL path
      return `/${config.storage.uploadDir}/${fullKey}`;
      
    } else if (this.provider === 's3' || this.provider === 'r2') {
      if (!this.s3Client) throw new Error('S3 Client not initialized');
      
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: fullKey,
        Body: buffer,
        ContentType: mimeType,
      });

      await this.s3Client.send(command);
      
      if (this.provider === 's3') {
        return `https://${this.bucket}.s3.${config.storage.s3.region}.amazonaws.com/${fullKey}`;
      } else {
        // R2 public URL format if configured, or just path if behind custom domain
        return `https://${config.storage.r2.bucket}.r2.cloudflarestorage.com/${fullKey}`; // Adjust if custom domain is used
      }
    } else {
      throw new Error(`Unsupported storage provider: ${this.provider}`);
    }
  }

  /**
   * Delete a file
   * @param {string} fileUrl - The URL/path stored in DB
   */
  async deleteFile(fileUrl) {
    if (!fileUrl) return;

    if (this.provider === 'local') {
       // fileUrl is like /uploads/company/documents/uuid-timestamp.pdf
       // extract relative path from fileUrl
       const relPath = fileUrl.replace(`/${config.storage.uploadDir}/`, '');
       const targetPath = path.join(__dirname, '..', '..', config.storage.uploadDir, relPath);
       
       try {
         await fs.unlink(targetPath);
       } catch (error) {
         if (error.code !== 'ENOENT') {
           logger.error(`Error deleting local file ${targetPath}:`, error);
         }
       }
    } else if (this.provider === 's3' || this.provider === 'r2') {
       if (!this.s3Client) throw new Error('S3 Client not initialized');
       
       // Extract key from URL
       // S3: https://bucket.s3.region.amazonaws.com/company/documents/file.pdf -> company/documents/file.pdf
       // R2: https://bucket.r2.cloudflarestorage.com/company/documents/file.pdf
       let key = '';
       try {
           const urlObj = new URL(fileUrl);
           key = urlObj.pathname.substring(1); // remove leading slash
       } catch(e) {
           key = fileUrl; // fallback if it's already a key
       }

       const command = new DeleteObjectCommand({
         Bucket: this.bucket,
         Key: key,
       });

       try {
         await this.s3Client.send(command);
       } catch (error) {
         logger.error(`Error deleting file from ${this.provider} ${key}:`, error);
       }
    }
  }

  async getPresignedPutUrl(destinationPath, originalName, mimeType) {
    const ext = path.extname(originalName);
    const fileName = `${uuidv4()}-${Date.now()}${ext}`;
    const fullKey = `${destinationPath}/${fileName}`;

    if (this.provider === 'local') {
      return {
        uploadUrl: `/api/v1/kyc/simulate-upload?key=${encodeURIComponent(fullKey)}`,
        key: fullKey,
      };
    } else {
      try {
        const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: fullKey,
          ContentType: mimeType,
        });
        const url = await getSignedUrl(this.s3Client, command, { expiresIn: 900 });
        return {
          uploadUrl: url,
          key: fullKey,
        };
      } catch (err) {
        logger.error('[FileUploadService] Failed to generate signed PUT URL', err);
        return {
          uploadUrl: `/api/v1/kyc/simulate-upload?key=${encodeURIComponent(fullKey)}`,
          key: fullKey,
        };
      }
    }
  }

  async getPresignedGetUrl(key) {
    if (!key) return null;
    const baseApiUrl = (config.appUrl || 'https://app.nanoshipy.com').replace(/\/+$/, '');
    if (this.provider === 'local') {
      return `${baseApiUrl}/uploads/${key}`;
    } else {
      try {
        const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
        const { GetObjectCommand } = require('@aws-sdk/client-s3');
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        });
        return await getSignedUrl(this.s3Client, command, { expiresIn: 900 });
      } catch (err) {
        logger.error('[FileUploadService] Failed to generate signed GET URL', err);
        return `${baseApiUrl}/uploads/${key}`;
      }
    }
  }
}

module.exports = new FileUploadService();
