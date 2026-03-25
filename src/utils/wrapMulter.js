
export function wrapMulter(
  storage,
  multerMiddleware
) {
  return (req, res, next) => {
    const currentStore = storage.getStore(); // lấy store hiện tại
    
    multerMiddleware(req, res, (err) => {
      if (err) return next(err);
      
      // Re-wrap callback trong đúng context cũ
      storage.run(currentStore, () => next());
    });
  };
}