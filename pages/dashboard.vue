<template>
  <v-container class="my-12">
    <h1 class="text-h3 font-weight-bold mb-2">Dashboard</h1>
    <h3 class="text-subtitle-1 text-grey-darken-1 mb-8">
      Welcome {{ userData?.name || 'Admin' }}! Here's an overview of your community.
    </h3>

    <div v-if="loading" class="text-center pa-10">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      <p class="mt-4">Loading dashboard metrics...</p>
    </div>
    <div v-else-if="error" class="text-center pa-10">
      <v-alert type="error" prominent border="start" icon="mdi-alert-circle-outline">
        Failed to load dashboard metrics. Please try again later.
      </v-alert>
    </div>

    <div v-else>
      <!-- Main Metric Cards -->
      <v-row>
        <v-col
          v-for="metric in mainMetrics"
          :key="metric.title"
          cols="12"
          sm="6"
          md="4"
          lg="3"
        >
          <v-card :color="metric.color" theme="dark" class="fill-height">
            <v-card-text class="d-flex flex-column" style="height: 160px;">
              <v-row no-gutters class="flex-grow-1">
                <v-col cols="3" class="d-flex align-start justify-center pt-3">
                  <v-icon size="40">{{ metric.icon }}</v-icon>
                </v-col>
                <v-col cols="9" class="text-right pa-3">
                  <div class="text-overline font-weight-bold" style="font-size: 0.85rem !important;">{{ metric.title }}</div>
                  <div class="text-h3 font-weight-bold">{{ metric.value }}</div>
                </v-col>
              </v-row>
              <div class="text-caption mt-auto align-self-start pl-3 pb-2">{{ metric.subtext }}</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Age Brackets Card -->
      <v-row class="mt-8">
        <v-col cols="12">
          <v-card>
            <v-card-title class="d-flex align-center">
              <v-icon left class="mr-2">mdi-account-details-outline</v-icon>
              Age Distribution
            </v-card-title>
            <v-divider></v-divider>
            <v-list lines="one" density="compact">
              <v-list-item
                v-for="bracket in ageBrackets"
                :key="bracket.bracket"
              >
                <v-list-item-title class="font-weight-medium">{{ bracket.bracket }} Years</v-list-item-title>
                <template v-slot:append>
                  <v-chip color="blue-grey" label size="small">{{ bracket.count }}</v-chip>
                </template>
              </v-list-item>
               <v-list-item v-if="!ageBrackets || ageBrackets.length === 0">
                  <v-list-item-title class="text-grey">No age data available.</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card>
        </v-col>
      </v-row>

      <!-- Existing Navigation Links (Optional - can be kept or removed) -->
      <v-row class="mt-10">
          <v-col cols="12">
              <h2 class="text-h5 font-weight-medium mb-4">Quick Navigation</h2>
          </v-col>
          <v-col cols="12" sm="6" md="4" lg="4" v-for="item in navItems" :key="item.to">
            <v-card :to="item.to" rounded="lg" elevation="2" class="text-left py-4 px-4 h-100" hover>
              <v-card-text class="h-100 d-flex flex-column justify-space-between">
                <div>
                    <v-avatar :color="item.color || 'primary'" variant="tonal" size="50" class="mb-3">
                    <v-icon :icon="item.icon" size="28"></v-icon>
                    </v-avatar>
                    <h3 class="text-h6 font-weight-medium text-black">{{ item.text }}</h3>
                </div>
                <v-card-subtitle class="mt-1 pa-0">{{ item.description }}</v-card-subtitle>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

    </div>
  </v-container>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useCookie } from '#app'; // Or your method for getting user data
import { useMyFetch } from '../composables/useMyFetch'; // Adjust path

const userData = useCookie('userData');
const loading = ref(true);
const error = ref(false);

// Refs for dashboard data
const totalPopulation = ref(0);
const totalHouseholds = ref(0);
const totalRegisteredVoters = ref(0);
const ageBrackets = ref([]); // Array of objects: { bracket: string, count: number }

// const { $myFetch } = useMyFetch(); // If your composable exposes it this way

onMounted(async () => {
  loading.value = true;
  error.value = false;
  try {
    const { data: dashboardData, error: fetchError } = await useMyFetch('/api/dashboard'); // Or useMyFetch directly

    if (fetchError.value || !dashboardData.value) {
      console.error('Failed to fetch dashboard metrics:', fetchError.value);
      error.value = true;
    } else {
      totalPopulation.value = dashboardData.value.totalPopulation || 0;
      totalHouseholds.value = dashboardData.value.totalHouseholds || 0;
      totalRegisteredVoters.value = dashboardData.value.totalRegisteredVoters || 0;
      ageBrackets.value = dashboardData.value.ageBrackets || [];
    }
  } catch (e) {
    console.error('Exception fetching dashboard metrics:', e);
    error.value = true;
  } finally {
    loading.value = false;
  }
});

const mainMetrics = computed(() => [
  {
    title: 'POPULATION',
    value: totalPopulation.value,
    icon: 'mdi-account-group-outline',
    color: 'blue-darken-2',
    subtext: 'Total Population',
  },
  {
    title: 'HOUSEHOLDS',
    value: totalHouseholds.value,
    icon: 'mdi-home-city-outline',
    color: 'deep-purple-darken-1',
    subtext: 'Total Households',
  },
  {
    title: 'FAMILIES', // Same as households in this context
    value: totalHouseholds.value,
    icon: 'mdi-human-male-female-child',
    color: 'green-darken-1',
    subtext: 'Total Families',
  },
  {
    title: 'VOTERS',
    value: totalRegisteredVoters.value,
    icon: 'mdi-account-check-outline',
    color: 'orange-darken-2',
    subtext: 'Registered Voters',
  },
]);

// Existing navigation items
const navItems = [
    { to: '/residents', text: 'Residents', icon: 'mdi-account-group', description: 'Manage all resident records.', color: 'primary' },
    { to: '/households', text: 'Households List', icon: 'mdi-home-group', description: 'View household summaries.', color: 'teal' },
    { to: '/admins', text: 'Admins', icon: 'mdi-shield-account', description: 'Manage administrator accounts.', color: 'indigo' },
    { to: '/documents', text: 'Documents', icon: 'mdi-file-document', description: 'Handle official documents.', color: 'blue-grey' },
    { to: '/officials', text: 'Officials', icon: 'mdi-bank', description: 'Barangay officials information.', color: 'brown' },
    { to: '/notifications', text: 'Notifications', icon: 'mdi-bell-ring', description: 'Send and manage alerts.', color: 'amber' },
  ];
</script>

<style scoped>
/* Add any specific styles if needed */
.v-card {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}
.v-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0,0,0,0.12) !important;
}
.text-overline { /* Adjust for Vuetify 3 if needed */
    letter-spacing: 0.075em !important; /* Make it more like an overline */
}
</style>