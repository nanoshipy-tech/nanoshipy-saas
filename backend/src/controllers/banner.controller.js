'use strict';

const { Banner } = require('../models');
const { success, error } = require('../utils/apiResponse');

const DEFAULT_BANNER = {
  id: 'default-active-banner',
  mode: 'text',
  image_url: null,
  headline: 'Flat 18% OFF on All Delhivery & ST Courier Air Shipments',
  subtext: 'Priority cargo linehaul dispatch + Free RTO Insurance protection up to ₹5,000 per consignment.',
  badge: 'Seasonal Partner Discount',
  code: 'FESTIVE18',
  cta_text: 'Apply & Book',
  cta_link: '/orders/new',
  is_active: true,
};

// GET /api/v1/banners/active (Public & Sellers)
exports.getActiveBanner = async (req, res) => {
  try {
    const banner = await Banner.findOne({
      where: { is_active: true },
      order: [['updated_at', 'DESC']],
    });

    // Return the active banner, or null if banners are disabled by Admin
    return success(res, banner || null);
  } catch (err) {
    console.error('getActiveBanner error:', err);
    return success(res, null);
  }
};

// GET /api/v1/banners (Platform Admin)
exports.getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.findAll({
      order: [['updated_at', 'DESC']],
    });
    return success(res, banners);
  } catch (err) {
    console.error('getAllBanners error:', err);
    return error(res, { code: 'BANNER_FETCH_FAILED', message: err.message }, 500);
  }
};

// POST /api/v1/banners (Platform Admin)
exports.createBanner = async (req, res) => {
  try {
    const {
      mode,
      image_url,
      headline,
      subtext,
      badge,
      code,
      cta_text,
      cta_link,
      is_active,
    } = req.body;

    const shouldBeActive = is_active !== undefined ? Boolean(is_active) : true;

    // Deactivate all banners unconditionally so strictly zero or one option is active
    await Banner.update({ is_active: false }, { where: {} });

    // If Admin explicitly disabled the banner or set mode to 'disabled'
    if (!shouldBeActive || mode === 'disabled') {
      return success(res, {
        is_active: false,
        mode: 'disabled',
        message: 'All banners deactivated successfully. No banner will be shown to sellers.',
      });
    }

    const banner = await Banner.create({
      mode: mode || (req.file || image_url ? 'image' : 'text'),
      image_url: req.file ? `/uploads/banners/${req.file.filename}` : (image_url || null),
      headline: headline || null,
      subtext: subtext || null,
      badge: badge || 'Platform Announcement',
      code: code || null,
      cta_text: cta_text || 'Apply & Book',
      cta_link: cta_link || '/orders/new',
      is_active: true,
    });

    return success(res, banner, 201);
  } catch (err) {
    console.error('createBanner error:', err);
    return error(res, { code: 'BANNER_CREATE_FAILED', message: err.message }, 500);
  }
};

// PUT /api/v1/banners/:id (Platform Admin)
exports.updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findByPk(id);
    if (!banner) {
      return error(res, { code: 'BANNER_NOT_FOUND', message: 'Banner not found' }, 404);
    }

    const {
      mode,
      image_url,
      headline,
      subtext,
      badge,
      code,
      cta_text,
      cta_link,
      is_active,
    } = req.body;

    if (is_active === true) {
      await Banner.update({ is_active: false }, { where: { is_active: true } });
    }

    await banner.update({
      mode: mode !== undefined ? mode : banner.mode,
      image_url: req.file ? `/uploads/banners/${req.file.filename}` : (image_url !== undefined ? image_url : banner.image_url),
      headline: headline !== undefined ? headline : banner.headline,
      subtext: subtext !== undefined ? subtext : banner.subtext,
      badge: badge !== undefined ? badge : banner.badge,
      code: code !== undefined ? code : banner.code,
      cta_text: cta_text !== undefined ? cta_text : banner.cta_text,
      cta_link: cta_link !== undefined ? cta_link : banner.cta_link,
      is_active: is_active !== undefined ? is_active : banner.is_active,
    });

    return success(res, banner);
  } catch (err) {
    console.error('updateBanner error:', err);
    return error(res, { code: 'BANNER_UPDATE_FAILED', message: err.message }, 500);
  }
};

// DELETE /api/v1/banners/:id (Platform Admin)
exports.deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findByPk(id);
    if (!banner) {
      return error(res, { code: 'BANNER_NOT_FOUND', message: 'Banner not found' }, 404);
    }
    await banner.destroy();
    return success(res, { message: 'Banner removed successfully' });
  } catch (err) {
    console.error('deleteBanner error:', err);
    return error(res, { code: 'BANNER_DELETE_FAILED', message: err.message }, 500);
  }
};
