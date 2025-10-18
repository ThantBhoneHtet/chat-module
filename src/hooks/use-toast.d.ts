export interface Toast {
  id: string;
  title?: string;
  description?: string;
  action?: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "default" | "destructive";
}

export interface ToastState {
  toasts: Toast[];
}

export interface UseToastReturn extends ToastState {
  toast: (props: Partial<Toast>) => { id: string; dismiss: () => void; update: (props: Partial<Toast>) => void };
  dismiss: (toastId?: string) => void;
}

export declare function useToast(): UseToastReturn;
export declare function toast(props: Partial<Toast>): { id: string; dismiss: () => void; update: (props: Partial<Toast>) => void };