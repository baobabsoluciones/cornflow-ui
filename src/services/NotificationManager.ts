import { useGeneralStore } from "@/stores/general";

class NotificationManager {
  private store = useGeneralStore();

  addSuccess(message: string) {
    this.store.addNotification({ message, type: 'success' });
  }

  addWarning(message: string) {
    this.store.addNotification({ message, type: 'warning' });
  }

  addInfo(message: string) {
    this.store.addNotification({ message, type: 'info' });
  }

  addError(message: string) {
    this.store.addNotification({ message, type: 'error' });
  }
}

export default new NotificationManager();