'use strict';

const platformAnalyticsService = require('../services/platformAnalytics.service');
const { success } = require('../utils/apiResponse');
const { BadRequestError, DateRangeTooLargeError } = require('../utils/errors');

const MAX_ANALYTICS_RANGE_DAYS = 366;

function validateDates(dateFrom, dateTo) {
  const to = dateTo ? new Date(dateTo) : new Date();
  const from = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    throw new BadRequestError('Invalid date formats. Please use YYYY-MM-DD.');
  }

  if (from > to) {
    throw new BadRequestError('date_from cannot be after date_to.');
  }

  const diffTime = Math.abs(to - from);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > MAX_ANALYTICS_RANGE_DAYS) {
    throw new DateRangeTooLargeError(`Date range exceeds limit of ${MAX_ANALYTICS_RANGE_DAYS} days.`);
  }

  return {
    date_from: from.toISOString().split('T')[0],
    date_to: to.toISOString().split('T')[0],
  };
}

const getRevenue = async (req, res, next) => {
  try {
    const period = req.query.period || 'monthly';
    const months = parseInt(req.query.months, 10) || 6;
    const data = await platformAnalyticsService.getRevenueOverview(period, months);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const getRevenueByPlan = async (req, res, next) => {
  try {
    const data = await platformAnalyticsService.getRevenueByPlan();
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const getTenantGrowth = async (req, res, next) => {
  try {
    const months = parseInt(req.query.months, 10) || 6;
    const data = await platformAnalyticsService.getTenantGrowth(months);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const getTopTenants = async (req, res, next) => {
  try {
    const sortBy = req.query.sort_by || 'volume'; // volume or revenue
    const limit = parseInt(req.query.limit, 10) || 20;
    const data = await platformAnalyticsService.getTopTenants(sortBy, limit);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const getCourierOverview = async (req, res, next) => {
  try {
    const dates = validateDates(req.query.date_from, req.query.date_to);
    const data = await platformAnalyticsService.getCourierOverview(dates.date_from, dates.date_to);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const getSystemHealth = async (req, res, next) => {
  try {
    const data = await platformAnalyticsService.getSystemHealth();
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const ingestTelemetry = async (req, res) => {
  try {
    const { event_type, path, referrer, session_id, visitor_id, screen_resolution, utm_source, utm_medium, utm_campaign, metadata } = req.body || {};
    if (!path) {
      return res.status(200).json({ success: true, message: 'Skipped - missing path' });
    }

    const { WebsiteVisitorEvent } = require('../models');
    if (WebsiteVisitorEvent) {
      await WebsiteVisitorEvent.create({
        event_type: event_type || 'page_view',
        path: String(path).substring(0, 500),
        referrer: referrer ? String(referrer).substring(0, 500) : null,
        session_id: session_id ? String(session_id).substring(0, 100) : null,
        visitor_id: visitor_id ? String(visitor_id).substring(0, 100) : null,
        user_agent: req.headers['user-agent'] ? String(req.headers['user-agent']).substring(0, 1000) : null,
        ip_address: req.ip || null,
        screen_resolution: screen_resolution ? String(screen_resolution).substring(0, 50) : null,
        utm_source: utm_source ? String(utm_source).substring(0, 100) : null,
        utm_medium: utm_medium ? String(utm_medium).substring(0, 100) : null,
        utm_campaign: utm_campaign ? String(utm_campaign).substring(0, 100) : null,
        metadata: metadata || null,
      });
    }

    return res.status(200).json({ success: true, received: true });
  } catch (err) {
    return res.status(200).json({ success: true, received: false });
  }
};

const getWebsiteTraffic = async (req, res, next) => {
  try {
    const { WebsiteVisitorEvent } = require('../models');
    const { Op } = require('sequelize');

    const days = parseInt(req.query.days, 10) || 30;
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    let events = [];
    if (WebsiteVisitorEvent) {
      events = await WebsiteVisitorEvent.findAll({
        where: {
          created_at: { [Op.gte]: sinceDate },
        },
        order: [['created_at', 'DESC']],
        limit: 2000,
      });
    }

    const totalViews = events.filter(e => e.event_type === 'page_view').length;
    const uniqueVisitors = new Set(events.map(e => e.visitor_id || e.ip_address).filter(Boolean)).size;
    const uniqueSessions = new Set(events.map(e => e.session_id).filter(Boolean)).size;
    const trackingLookups = events.filter(e => e.event_type === 'track_search').length;

    const pageCounts = {};
    for (const ev of events) {
      if (ev.event_type === 'page_view') {
        pageCounts[ev.path] = (pageCounts[ev.path] || 0) + 1;
      }
    }
    const topPages = Object.entries(pageCounts)
      .map(([pagePath, count]) => ({ path: pagePath, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const dailyMap = {};
    for (const ev of events) {
      const dateStr = new Date(ev.created_at).toISOString().split('T')[0];
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { date: dateStr, views: 0, visitors: new Set() };
      }
      if (ev.event_type === 'page_view') {
        dailyMap[dateStr].views += 1;
      }
      if (ev.visitor_id || ev.ip_address) {
        dailyMap[dateStr].visitors.add(ev.visitor_id || ev.ip_address);
      }
    }
    const dailyTrend = Object.values(dailyMap).map(d => ({
      date: d.date,
      views: d.views,
      visitors: d.visitors.size,
    })).sort((a, b) => a.date.localeCompare(b.date));

    return success(res, {
      totalViews,
      uniqueVisitors,
      uniqueSessions,
      trackingLookups,
      topPages,
      dailyTrend,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getRevenue,
  getRevenueByPlan,
  getTenantGrowth,
  getTopTenants,
  getCourierOverview,
  getSystemHealth,
  ingestTelemetry,
  getWebsiteTraffic,
};

