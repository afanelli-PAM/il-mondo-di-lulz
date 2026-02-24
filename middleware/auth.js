function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }
  next();
}

function guestOnly(req, res, next) {
  if (req.session.userId) {
    return res.redirect('/profilo');
  }
  next();
}

module.exports = { requireAuth, guestOnly };
