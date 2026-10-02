import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { emitAuthExpired } from '@/src/authSession';

let isLoggingOut = false;

const API_BASE_URL = 'https://choicetiffinservices.com/store-api/';
//const API_BASE_URL = 'https://choicetiffinservices.com/api/';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(request => {
  console.log('>>> API REQUEST >>>');
  console.log(`${request.method?.toUpperCase()} ${request.baseURL || ''}${request.url || ''}`);
  if (request.params) {
    console.log('Params:', JSON.stringify(request.params, null, 2));
  }
  if (request.data) {
    console.log('Body:', JSON.stringify(request.data, null, 2));
  }
  return request;
});

apiClient.interceptors.response.use(
  response => {
    console.log('<<< API RESPONSE <<<');
    console.log(`${response.config.method?.toUpperCase()} ${response.config.baseURL || ''}${response.config.url || ''}`);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));
    return response;
  },
  async error => {
    console.log('<<< API ERROR <<<');
    if (error.config) {
      console.log(`${error.config.method?.toUpperCase()} ${error.config.baseURL || ''}${error.config.url || ''}`);
    }
    console.log('Error Message:', error.message);
    if (error.response) {
      console.log('Error Response Data:', JSON.stringify(error.response.data, null, 2));
    }

    if (error.response?.status === 401 && !isLoggingOut) {
      isLoggingOut = true;
      await AsyncStorage.multiRemove([
        'store_token',
        'store_id',
        'store_name',
        'store_email',
        'store_phone',
        'store_approved',
      ]);
      emitAuthExpired();
      isLoggingOut = false;
    }
    return Promise.reject(error);
  }
);

const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem('store_token');
  return { Authorization: `Bearer ${token}` };
};

// ─── Auth ────────────────────────────────────────────────────────────────────

export const storeSignup = async (data: object) => {
  const response = await apiClient.post('signup', data);
  return response.data;
};

export const storeVerifyEmail = async (storeId: string, otp: string) => {
  const response = await apiClient.post('verifyEmail', { store_id: storeId, otp });
  return response.data;
};

export const storeResendOtp = async (storeId: string) => {
  const response = await apiClient.get('resendOtp', { params: { store_id: storeId } });
  return response.data;
};

export const storeLogin = async (email: string, password: string) => {
  const response = await apiClient.post('login', { email, password });
  return response.data;
};

export const storeForgot = async (email: string) => {
  const response = await apiClient.post('forgot', { email });
  return response.data;
};

export const storeLogout = async () => {
  const response = await apiClient.get('logout', { headers: await getAuthHeaders() });
  return response.data;
};

export const storeDeleteAccount = async (password: string) => {
  const response = await apiClient.post('deleteAccount', { password }, { headers: await getAuthHeaders() });
  return response.data;
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

export const storeHome = async () => {
  const response = await apiClient.get('home', { headers: await getAuthHeaders() });
  return response.data;
};

export const storeProfile = async () => {
  const response = await apiClient.get('profile', { headers: await getAuthHeaders() });
  return response.data;
};

export const getApproval = async () => {
  const response = await apiClient.get('getApproval', { headers: await getAuthHeaders() });
  return response.data;
};

export const storeUpdateProfile = async (data: object) => {
  const response = await apiClient.post('profile', data, { headers: await getAuthHeaders() });
  return response.data;
};

// ─── Orders ──────────────────────────────────────────────────────────────────

export const storeOrders = async (status: string = 'Active', page: number = 1) => {
  const response = await apiClient.get('orders', { params: { status, page }, headers: await getAuthHeaders() });
  return response.data;
};

export const storeViewOrder = async (orderId: number | string) => {
  const response = await apiClient.get('order', { params: { order_id: orderId }, headers: await getAuthHeaders() });
  return response.data;
};

export const storePauseSubscription = async (orderId: number | string) => {
  const response = await apiClient.get('pauseSubscription', { params: { order_id: orderId }, headers: await getAuthHeaders() });
  return response.data;
};

export const storeResumeSubscription = async (orderId: number | string) => {
  const response = await apiClient.get('resumeSubscription', { params: { order_id: orderId }, headers: await getAuthHeaders() });
  return response.data;
};

export const storeCancelSubscription = async (orderId: number | string) => {
  const response = await apiClient.get('cancelSubscription', { params: { order_id: orderId }, headers: await getAuthHeaders() });
  return response.data;
};

export const storeCompleteSubscription = async (orderId: number | string) => {
  const response = await apiClient.get('completeSubscription', { params: { order_id: orderId }, headers: await getAuthHeaders() });
  return response.data;
};

export const storeNewOrderData = async () => {
  const response = await apiClient.get('newOrderData', { headers: await getAuthHeaders() });
  return response.data;
};

export const storeGetProduct = async (cateName: string) => {
  const response = await apiClient.get('getProduct', { params: { cate_name: cateName }, headers: await getAuthHeaders() });
  return response.data;
};

export const storeCreateOrder = async (data: object) => {
  const response = await apiClient.post('createOrder', data, { headers: await getAuthHeaders() });
  return response.data;
};

export const storeZones = async () => {
  const response = await apiClient.get('zone', { headers: await getAuthHeaders() });
  return response.data;
};

export const storeZoneStore = async (data: object) => {
  const response = await apiClient.post('zone', data, { headers: await getAuthHeaders() });
  return response.data;
};

export const storeZoneUpdate = async (id: number | string, data: object) => {
  const response = await apiClient.post(`zone/${id}`, data, { headers: await getAuthHeaders() });
  return response.data;
};

export const storeZoneDelete = async (id: number | string) => {
  const response = await apiClient.get('zoneDelete', { params: { id }, headers: await getAuthHeaders() });
  return response.data;
};

export const storeZoneStatus = async (id: number | string) => {
  const response = await apiClient.get('zoneStatus', { params: { id }, headers: await getAuthHeaders() });
  return response.data;
};

export const storeAssignZone = async (orderId: number | string, zoneId: number | string) => {
  const response = await apiClient.post('assignZone', { order_id: orderId, zone_id: zoneId }, { headers: await getAuthHeaders() });
  return response.data;
};

// ─── Meals ───────────────────────────────────────────────────────────────────

export const storeMeals = async () => {
  const response = await apiClient.get('meal', { headers: await getAuthHeaders() });
  return response.data;
};

export const storeMealStore = async (data: object) => {
  const response = await apiClient.post('meal', data, { headers: await getAuthHeaders() });
  return response.data;
};

export const storeMealUpdate = async (id: number | string, data: object) => {
  const response = await apiClient.post(`meal/${id}`, data, { headers: await getAuthHeaders() });
  return response.data;
};

export const storeMealDelete = async (id: number | string) => {
  const response = await apiClient.get('mealDelete', { params: { id }, headers: await getAuthHeaders() });
  return response.data;
};

export const storeMealStatus = async (id: number | string) => {
  const response = await apiClient.get('mealStatus', { params: { id }, headers: await getAuthHeaders() });
  return response.data;
};

// ─── Categories ──────────────────────────────────────────────────────────────

export const storeCates = async () => {
  const response = await apiClient.get('cate', { headers: await getAuthHeaders() });
  return response.data;
};

export const storeCateStore = async (data: object) => {
  const response = await apiClient.post('cate', data, { headers: await getAuthHeaders() });
  return response.data;
};

export const storeCateUpdate = async (id: number | string, data: object) => {
  const response = await apiClient.post(`cate/${id}`, data, { headers: await getAuthHeaders() });
  return response.data;
};

export const storeCateDelete = async (id: number | string) => {
  const response = await apiClient.get('cateDelete', { params: { id }, headers: await getAuthHeaders() });
  return response.data;
};

export const storeCateStatus = async (id: number | string) => {
  const response = await apiClient.get('cateStatus', { params: { id }, headers: await getAuthHeaders() });
  return response.data;
};

// ─── Deliveries ──────────────────────────────────────────────────────────────

export const storeTodayDelivery = async (cateId?: string | number) => {
  const params: any = {};
  if (cateId) params.cate_id = cateId;
  const response = await apiClient.get('todayDelivery', { params, headers: await getAuthHeaders() });
  return response.data;
};

export const storeUpcomingDelivery = async (
  fromDate?: string,
  toDate?: string,
  cateId?: string | number,
) => {
  const params: any = {};
  if (fromDate) params.from_date = fromDate;
  if (toDate) params.to_date = toDate;
  if (cateId) params.cate_id = cateId;
  const response = await apiClient.get('upcomingDelivery', { params, headers: await getAuthHeaders() });
  return response.data;
};

export const storeHistoryDelivery = async (
  fromDate?: string,
  toDate?: string,
  cateId?: string | number,
) => {
  const params: any = {};
  if (fromDate) params.from_date = fromDate;
  if (toDate) params.to_date = toDate;
  if (cateId) params.cate_id = cateId;
  const response = await apiClient.get('historyDelivery', { params, headers: await getAuthHeaders() });
  return response.data;
};

export const storeSkipDelivery = async (deliveryId: number | string, orderId: number | string) => {
  const response = await apiClient.get('skipDelivery', { params: { delivery_id: deliveryId, order_id: orderId }, headers: await getAuthHeaders() });
  return response.data;
};

export const storeMarkDelivered = async (deliveryId: number | string) => {
  const response = await apiClient.post('markPickup', { id: deliveryId }, { headers: await getAuthHeaders() });
  return response.data;
};

export const storeStartCooking = async (data: {
  delivery_ids: Array<number | string>;
  slot: string;
}) => {
  const response = await apiClient.post('startCooking', data, { headers: await getAuthHeaders() });
  return response.data;
};

export const storeAddChecklist = async (deliveryId: number | string, checklist: string[]) => {
  const response = await apiClient.post(
    'addChecklist',
    { delivery_id: deliveryId, checklist },
    { headers: await getAuthHeaders() },
  );
  return response.data;
};

export const storeAssignRider = async (deliveryId: number | string, orderId: number | string, riderId: number | string) => {
  const response = await apiClient.post('assignRider', { id: deliveryId, order_id: orderId, rider_id: riderId }, { headers: await getAuthHeaders() });
  return response.data;
};

// ─── Reports ─────────────────────────────────────────────────────────────────

export const storeSaleReport = async (from?: string, to?: string) => {
  const params: any = {};
  if (from) { params.from = from; params.to = to; }
  const response = await apiClient.get('saleReport', { params, headers: await getAuthHeaders() });
  return response.data;
};

export const storeOrderReport = async () => {
  const response = await apiClient.get('orderReport', { headers: await getAuthHeaders() });
  return response.data;
};

export const storeProductReport = async (type?: number) => {
  const params: any = {};
  if (type) params.type = type;
  const response = await apiClient.get('productReport', { params, headers: await getAuthHeaders() });
  return response.data;
};

export const storeRiderReport = async () => {
  const response = await apiClient.get('riderReport', { headers: await getAuthHeaders() });
  return response.data;
};

export const storeEarning = async (range?: { from_date?: string; to_date?: string }) => {
  const params: any = {};
  if (range?.from_date) params.from_date = range.from_date;
  if (range?.to_date) params.to_date = range.to_date;
  const response = await apiClient.get('getEarning', { params, headers: await getAuthHeaders() });
  return response.data;
};

export const storePayoutRequest = async (bankId: number | string) => {
  const response = await apiClient.post(
    'payoutRequest',
    { bank_id: bankId },
    { headers: await getAuthHeaders() },
  );
  return response.data;
};

export const storePayoutHistory = async () => {
  try {
    const response = await apiClient.get('payout-history', { headers: await getAuthHeaders() });
    return response.data;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      try {
        const alt = await apiClient.get('payout_history', { headers: await getAuthHeaders() });
        return alt.data;
      } catch {
        const alt2 = await axios.get('https://choicetiffinservices.com/api/payout-history', {
          headers: await getAuthHeaders(),
        });
        return alt2.data;
      }
    }
    throw err;
  }
};

export const storeGetBankDetail = async () => {
  const response = await apiClient.get('getBankDetail', { headers: await getAuthHeaders() });
  return response.data;
};

export const storeSaveBankDetail = async (data: {
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  branch_name: string;
  upi_id: string;
}) => {
  const response = await apiClient.post('saveBankDetail', data, { headers: await getAuthHeaders() });
  return response.data;
};

export const storeGetLeaveRequest = async () => {
  const response = await apiClient.get('getLeaveRequest', { headers: await getAuthHeaders() });
  return response.data;
};

export const storeSaveLeaveRequest = async (data: { leave_date: string; reason: string }) => {
  const response = await apiClient.post('saveLeaveRequest', data, { headers: await getAuthHeaders() });
  return response.data;
};

export const storeGetPenalties = async () => {
  const response = await apiClient.get('getPenalties', { headers: await getAuthHeaders() });
  return response.data;
};

export const storeGetIncentives = async () => {
  const response = await apiClient.get('getIncentives', { headers: await getAuthHeaders() });
  return response.data;
};

export const storeGetCustomerReviews = async (page = 1) => {
  const response = await apiClient.get('meal-reviews', {
    params: { page },
    headers: await getAuthHeaders(),
  });
  return response.data;
};

export const storeGetSettings = async () => {
  try {
    const response = await apiClient.get('get-settings', { headers: await getAuthHeaders() });
    return response.data;
  } catch {
    const alt = await axios.get('https://choicetiffinservices.com/api/get-settings', {
      timeout: 30000,
    });
    return alt.data;
  }
};

/** Public settings (works on signup before login). */
export const storeGetPublicSettings = async () => {
  try {
    const response = await axios.get('https://choicetiffinservices.com/api/get-settings', {
      timeout: 30000,
    });
    return response.data;
  } catch {
    return storeGetSettings();
  }
};

export const getTodayPrintUrl = (storeId: string | number, token?: string | null) => {
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
  const url = `${base}today-deliveries/print/${storeId}`;
  if (!token) return url;
  return `${url}?token=${encodeURIComponent(token)}`;
};

export const storeViewPrint = async (storeId: string | number) => {
  const headers = await getAuthHeaders();
  const response = await apiClient.get(`today-deliveries/print/${storeId}`, {
    headers,
    responseType: 'arraybuffer',
    transformResponse: [(data) => data],
  });
  const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
  return { data: response.data as ArrayBuffer, contentType };
};
export const storeGetSupportTickets = async () => {
  const response = await apiClient.get('get_complaints', { headers: await getAuthHeaders() });
  return response.data;
};

export const storeSaveSupportTicket = async (data: {  subject: string;
  complaint: string;
  user_type: string;
  image?: string; }) => {
    console.log(data)
  const response = await apiClient.post('save_complaint', data, { headers: await getAuthHeaders() });
  return response.data;
};

export const storeEditComplaint = async (data: {
  complaint_id: number | string;
  subject: string;
  complaint: string;
  image?: string;
}) => {
   const response = await apiClient.post('edit_complaint', data, { headers: await getAuthHeaders() });
  return response.data;
};

// ─── Riders ──────────────────────────────────────────────────────────────────

export const storeRiders = async () => {
  const response = await apiClient.get('rider', { headers: await getAuthHeaders() });
  return response.data;
};

export const storeRiderStore = async (data: FormData) => {
  const headers = await getAuthHeaders();
  const response = await apiClient.post('rider', data, {
    headers: { ...headers, 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const storeRiderUpdate = async (id: number | string, data: FormData) => {
  const headers = await getAuthHeaders();
  const response = await apiClient.post(`rider/${id}`, data, {
    headers: { ...headers, 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const storeRiderDelete = async (id: number | string) => {
  const response = await apiClient.get('riderDelete', { params: { id }, headers: await getAuthHeaders() });
  return response.data;
};

export const storeRiderStatus = async (id: number | string) => {
  const response = await apiClient.get('riderStatus', { params: { id }, headers: await getAuthHeaders() });
  return response.data;
};

export const storeRiderHistory = async (riderId: number | string, cateId?: number | string) => {
  const params: any = { rider_id: riderId };
  if (cateId) params.cate_id = cateId;
  const response = await apiClient.get('riderHistory', { params, headers: await getAuthHeaders() });
  return response.data;
};

export const storeRiderPayout = async (riderId: number | string) => {
  const response = await apiClient.get('riderPayout', { params: { rider_id: riderId }, headers: await getAuthHeaders() });
  return response.data;
};

export const storeRiderApprovePayout = async (id: number | string, riderId: number | string) => {
  const response = await apiClient.post('riderApprovePayout', { id, rider_id: riderId }, { headers: await getAuthHeaders() });
  return response.data;
};

export const storeRiderDeclinePayout = async (id: number | string, riderId: number | string, notes: string) => {
  const response = await apiClient.post('riderDeclinePayout', { id, rider_id: riderId, notes }, { headers: await getAuthHeaders() });
  return response.data;
};

// ─── Menus (public /api) ──────────────────────────────────────────────────────

export type MenuItem = {
  id: number;
  category: string;
  type: string;
  day: string;
  menu: string;
};

export const getMenus = async (): Promise<{ data: MenuItem[] }> => {
  const response = await axios.get('https://choicetiffinservices.com/api/getMenus', {
    timeout: 30000,
  });
  return response.data;
};

// ─── Training Videos ──────────────────────────────────────────────────────────

export type TrainingVideo = {
  id: number | string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  url?: string | null;
  link?: string | null;
  youtube_url?: string | null;
  video_url?: string | null;
  youtube_id?: string | null;
  video_id?: string | null;
  thumbnail?: string | null;
  thumb?: string | null;
  image?: string | null;
};

export const storeGetTrainingVideos = async () => {
  const response = await apiClient.get('training-videos?type=store', { headers: await getAuthHeaders() });
  return response.data;
};

export const storeGetDemoVideos = async () => {
  const response = await apiClient.get('getDemoVideos', { headers: await getAuthHeaders() });
  return response.data;
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const storeNotifications = async () => {
  const headers = await getAuthHeaders();
  const response = await apiClient.get('notifications', { headers });
  return response.data;
};
