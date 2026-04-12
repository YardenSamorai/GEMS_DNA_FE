import { motion } from "framer-motion";

const LoadingBar = ({ active, progress }) => {
  if (!active) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-primary-100">
      <motion.div
        className="h-full bg-primary"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.3 }}
      />
    </div>
  );
};

export default LoadingBar;
export { LoadingBar };
