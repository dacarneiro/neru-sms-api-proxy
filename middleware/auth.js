import jwt from 'jsonwebtoken';

const { TOKEN_KEY } = process.env;

export const verifyToken = (req, res, next) => {
  const token =
    req.body.token || req.query.token || req.headers['x-access-token'];

  if (!token) {
    // return res.status(403).send('A token is required for authentication');
    return res.status(200).render('login.ejs', {
      message: 'A token is required for authentication',
    });
  }
  try {
    const decoded = jwt.verify(token, TOKEN_KEY);
    req.user = decoded;
  } catch (err) {
    return res.status(401).send('Invalid Token');
  }
  return next();
};
