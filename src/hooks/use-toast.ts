import { toast } from "react-hot-toast";

export const useToast = () => {
  return {
    showToast: (message: string, options?: any) => toast(message, options),
    showSuccess: (message: string, options?: any) => toast.success(message, options),
    showError: (message: string, options?: any) => toast.error(message, options),
  };
};
