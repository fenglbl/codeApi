const RequestLog = require('../models/RequestLog');

function serialize(doc) {
  return {
    id: doc._id,
    path: doc.path,
    model: doc.model || '',
    isStream: !!doc.isStream,
    statusCode: doc.statusCode || 0,
    durationMs: doc.durationMs || 0,
    firstByteMs: doc.firstByteMs || 0,
    promptTokens: doc.promptTokens || 0,
    completionTokens: doc.completionTokens || 0,
    totalTokens: doc.totalTokens || 0,
    cacheReadTokens: doc.cacheReadTokens || 0,
    cacheWriteTokens: doc.cacheWriteTokens || 0,
    inputChars: doc.inputChars || 0,
    outputChars: doc.outputChars || 0,
    errorMessage: doc.errorMessage || '',
    localKey: doc.localKeyId ? {
      id: doc.localKeyId._id,
      name: doc.localKeyId.name,
      keyPrefix: doc.localKeyId.keyPrefix
    } : null,
    upstream: doc.upstreamId ? {
      id: doc.upstreamId._id,
      name: doc.upstreamId.name,
      baseUrl: doc.upstreamId.baseUrl
    } : null,
    createdAt: doc.createdAt
  };
}

async function list(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 5000);
    const query = {};

    if (req.query.path) {
      query.path = { $regex: String(req.query.path).trim(), $options: 'i' };
    }

    if (req.query.statusCode) {
      query.statusCode = Number(req.query.statusCode);
    }

    if (req.query.localKeyId) {
      query.localKeyId = req.query.localKeyId;
    }

    if (req.query.upstreamId) {
      query.upstreamId = req.query.upstreamId;
    }

    if (req.query.from || req.query.to) {
      query.createdAt = {};

      if (req.query.from) {
        const fromDate = new Date(req.query.from);
        if (!Number.isNaN(fromDate.getTime())) {
          query.createdAt.$gte = fromDate;
        }
      }

      if (req.query.to) {
        const toDate = new Date(req.query.to);
        if (!Number.isNaN(toDate.getTime())) {
          query.createdAt.$lte = toDate;
        }
      }

      if (!Object.keys(query.createdAt).length) {
        delete query.createdAt;
      }
    }

    const rows = await RequestLog.find(query)
      .populate('localKeyId', 'name keyPrefix')
      .populate('upstreamId', 'name baseUrl')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
