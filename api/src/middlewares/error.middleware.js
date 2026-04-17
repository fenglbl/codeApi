module.exports = function errorHandler(err, req, res, next) {
  console.error(err);

  const lowered = String(err?.message || '').toLowerCase()
  if (err?.type === 'entity.too.large' || err?.status === 413 || lowered.includes('request entity too large')) {
    return res.status(413).json({
      message: '请求体太大，请压缩图片或减少图片数量后再试'
    });
  }

  res.status(err.statusCode || err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
};
