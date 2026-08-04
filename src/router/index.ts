import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: { name: 'devices' } },
        {
          path: 'devices',
          name: 'devices',
          component: () => import('@/views/devices/DevicesView.vue'),
        },
        {
          path: 'devices/:deviceId/channels',
          name: 'device-channels',
          component: () => import('@/views/devices/DeviceChannelsView.vue'),
        },
        {
          path: 'play/:deviceId/:channelId',
          name: 'play',
          component: () => import('@/views/play/PlayView.vue'),
        },
        {
          path: 'record/:deviceId/:channelId',
          name: 'record-query',
          component: () => import('@/views/record/RecordQueryView.vue'),
        },
        {
          path: 'playback/:deviceId/:channelId',
          name: 'playback',
          component: () => import('@/views/playback/PlaybackView.vue'),
        },
        {
          path: 'media-servers',
          name: 'media-servers',
          component: () => import('@/views/server/MediaServersView.vue'),
        },
        {
          path: 'proxies',
          name: 'proxies',
          component: () => import('@/views/streamProxy/ProxiesView.vue'),
        },
        {
          path: 'pushes',
          name: 'pushes',
          component: () => import('@/views/streamPush/PushesView.vue'),
        },
        {
          path: 'platforms',
          name: 'platforms',
          component: () => import('@/views/platform/PlatformsView.vue'),
        },
        {
          path: 'record-plans',
          name: 'record-plans',
          component: () => import('@/views/recordPlan/RecordPlansView.vue'),
        },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.token) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.public && auth.token) {
    return { path: '/' }
  }
})

export default router
