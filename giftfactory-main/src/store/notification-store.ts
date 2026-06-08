'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/api';

const get = axiosInstance.get.bind(axiosInstance);
const patch = axiosInstance.patch.bind(axiosInstance);

export type NotificationItem = {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  metadata?: any;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
};

/**
 * Hook to retrieve all notifications for the current authenticated user.
 */
export function useNotifications(options?: { enabled?: boolean }) {
  return useQuery<NotificationItem[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await get(API_ENDPOINTS.customer.notifications);
      const raw = data?.data ?? data ?? [];
      return (Array.isArray(raw) ? raw : []).map((item: any) => ({
        ...item,
        id: item._id || item.id,
      }));
    },
    refetchInterval: 10000, // Auto-refetch every 10 seconds for real-time notifications
    ...options,
  });
}

/**
 * Mutation to mark a specific notification as read.
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await patch(API_ENDPOINTS.customer.notificationRead(id));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
