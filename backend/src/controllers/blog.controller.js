'use strict';

const { Op } = require('sequelize');
const { BlogPost } = require('../models');
const { success, error } = require('../utils/apiResponse');

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function estimateReadingTime(content = '') {
  const wordsPerMinute = 200;
  const wordCount = content.trim().split(/\s+/).length;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return `${minutes || 1} min read`;
}

// GET /api/v1/blogs (Public)
exports.getPublicBlogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '12', 10)));
    const offset = (page - 1) * limit;

    const where = {
      status: 'published',
      published_at: { [Op.lte]: new Date() },
    };

    if (req.query.category && req.query.category.toLowerCase() !== 'all') {
      where.category = { [Op.iLike]: req.query.category };
    }

    if (req.query.search) {
      const q = `%${req.query.search.trim()}%`;
      where[Op.or] = [
        { title: { [Op.iLike]: q } },
        { excerpt: { [Op.iLike]: q } },
        { content: { [Op.iLike]: q } },
      ];
    }

    const { count, rows } = await BlogPost.findAndCountAll({
      where,
      limit,
      offset,
      order: [['published_at', 'DESC']],
      attributes: [
        'id', 'title', 'h1_title', 'slug', 'excerpt', 'featured_image',
        'category', 'tags', 'author_name', 'author_avatar',
        'reading_time', 'published_at', 'views_count'
      ],
    });

    return success(res, {
      items: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error('getPublicBlogs error:', err);
    return error(res, { code: 'BLOG_FETCH_FAILED', message: err.message }, 500);
  }
};

// GET /api/v1/blogs/:slug (Public)
exports.getPublicBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const post = await BlogPost.findOne({
      where: {
        slug,
        status: 'published',
      },
    });

    if (!post) {
      return error(res, { code: 'BLOG_NOT_FOUND', message: 'Article not found' }, 404);
    }

    // Increment views count asynchronously
    post.increment('views_count', { by: 1 }).catch(() => {});

    // Fetch related articles in same category
    const related = await BlogPost.findAll({
      where: {
        id: { [Op.ne]: post.id },
        category: post.category,
        status: 'published',
      },
      limit: 3,
      order: [['published_at', 'DESC']],
      attributes: [
        'id', 'title', 'slug', 'excerpt', 'featured_image',
        'category', 'reading_time', 'published_at'
      ],
    });

    return success(res, {
      post,
      related,
    });
  } catch (err) {
    console.error('getPublicBlogBySlug error:', err);
    return error(res, { code: 'BLOG_FETCH_FAILED', message: err.message }, 500);
  }
};

// GET /api/v1/blogs/admin/all (Platform Admin)
exports.getAdminBlogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const offset = (page - 1) * limit;

    const where = {};
    if (req.query.status && req.query.status !== 'all') {
      where.status = req.query.status;
    }
    if (req.query.category && req.query.category !== 'all') {
      where.category = req.query.category;
    }
    if (req.query.search) {
      const q = `%${req.query.search.trim()}%`;
      where[Op.or] = [
        { title: { [Op.iLike]: q } },
        { slug: { [Op.iLike]: q } },
      ];
    }

    const { count, rows } = await BlogPost.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    return success(res, {
      items: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error('getAdminBlogs error:', err);
    return error(res, { code: 'BLOG_ADMIN_FETCH_FAILED', message: err.message }, 500);
  }
};

// GET /api/v1/blogs/admin/:id (Platform Admin)
exports.getAdminBlogById = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await BlogPost.findByPk(id);
    if (!post) {
      return error(res, { code: 'BLOG_NOT_FOUND', message: 'Article not found' }, 404);
    }
    return success(res, post);
  } catch (err) {
    console.error('getAdminBlogById error:', err);
    return error(res, { code: 'BLOG_FETCH_FAILED', message: err.message }, 500);
  }
};

// POST /api/v1/blogs (Platform Admin)
exports.createBlog = async (req, res) => {
  try {
    const {
      title,
      h1_title,
      faq_items,
      slug: customSlug,
      excerpt,
      content,
      featured_image,
      category,
      tags,
      author_name,
      author_avatar,
      reading_time,
      status,
      meta_title,
      meta_description,
      published_at,
    } = req.body;

    if (!title || !content) {
      return error(res, { code: 'VALIDATION_ERROR', message: 'Title and content are required' }, 400);
    }

    let finalSlug = slugify(customSlug || title);
    // Ensure slug uniqueness
    const existing = await BlogPost.findOne({ where: { slug: finalSlug } });
    if (existing) {
      finalSlug = `${finalSlug}-${Date.now().toString(36)}`;
    }

    const post = await BlogPost.create({
      title,
      h1_title: h1_title || null,
      faq_items: Array.isArray(faq_items) ? faq_items : (typeof faq_items === 'string' ? JSON.parse(faq_items || '[]') : []),
      slug: finalSlug,
      excerpt: excerpt || title,
      content,
      featured_image: req.file ? `/uploads/blogs/${req.file.filename}` : (featured_image || null),
      category: category || 'Logistics',
      tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : []),
      author_name: author_name || 'NanoShipy Editorial',
      author_avatar: author_avatar || null,
      reading_time: reading_time || estimateReadingTime(content),
      status: status || 'published',
      meta_title: meta_title || title,
      meta_description: meta_description || excerpt || title,
      published_at: published_at || new Date(),
    });

    return success(res, post, 201);
  } catch (err) {
    console.error('createBlog error:', err);
    return error(res, { code: 'BLOG_CREATE_FAILED', message: err.message }, 500);
  }
};

// PUT /api/v1/blogs/:id (Platform Admin)
exports.updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await BlogPost.findByPk(id);
    if (!post) {
      return error(res, { code: 'BLOG_NOT_FOUND', message: 'Article not found' }, 404);
    }

    const {
      title,
      h1_title,
      faq_items,
      slug: customSlug,
      excerpt,
      content,
      featured_image,
      category,
      tags,
      author_name,
      author_avatar,
      reading_time,
      status,
      meta_title,
      meta_description,
      published_at,
    } = req.body;

    let finalSlug = post.slug;
    if (customSlug && customSlug !== post.slug) {
      finalSlug = slugify(customSlug);
      const existing = await BlogPost.findOne({ where: { slug: finalSlug, id: { [Op.ne]: id } } });
      if (existing) {
        finalSlug = `${finalSlug}-${Date.now().toString(36)}`;
      }
    }

    await post.update({
      title: title !== undefined ? title : post.title,
      h1_title: h1_title !== undefined ? h1_title : post.h1_title,
      faq_items: faq_items !== undefined ? (Array.isArray(faq_items) ? faq_items : (typeof faq_items === 'string' ? JSON.parse(faq_items || '[]') : [])) : post.faq_items,
      slug: finalSlug,
      excerpt: excerpt !== undefined ? excerpt : post.excerpt,
      content: content !== undefined ? content : post.content,
      featured_image: req.file ? `/uploads/blogs/${req.file.filename}` : (featured_image !== undefined ? featured_image : post.featured_image),
      category: category !== undefined ? category : post.category,
      tags: tags !== undefined ? (Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : [])) : post.tags,
      author_name: author_name !== undefined ? author_name : post.author_name,
      author_avatar: author_avatar !== undefined ? author_avatar : post.author_avatar,
      reading_time: reading_time || (content ? estimateReadingTime(content) : post.reading_time),
      status: status !== undefined ? status : post.status,
      meta_title: meta_title !== undefined ? meta_title : post.meta_title,
      meta_description: meta_description !== undefined ? meta_description : post.meta_description,
      published_at: published_at !== undefined ? published_at : post.published_at,
    });

    return success(res, post);
  } catch (err) {
    console.error('updateBlog error:', err);
    return error(res, { code: 'BLOG_UPDATE_FAILED', message: err.message }, 500);
  }
};

// DELETE /api/v1/blogs/:id (Platform Admin)
exports.deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await BlogPost.findByPk(id);
    if (!post) {
      return error(res, { code: 'BLOG_NOT_FOUND', message: 'Article not found' }, 404);
    }
    await post.destroy();
    return success(res, { message: 'Article deleted successfully' });
  } catch (err) {
    console.error('deleteBlog error:', err);
    return error(res, { code: 'BLOG_DELETE_FAILED', message: err.message }, 500);
  }
};
