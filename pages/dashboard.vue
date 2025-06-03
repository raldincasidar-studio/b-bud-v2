<template>
  <v-container class="my-12">
    <h1 class="text-h3 font-weight-bold mb-2">Dashboard Overview</h1>
    <h3 class="text-subtitle-1 text-grey-darken-1 mb-8">
      Welcome {{ userData?.name || 'Admin' }}! Current community and transaction status.
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
      <!-- Main Metric Cards - REVISED -->
      <v-row>
        <v-col v-for="metric in mainMetrics" :key="metric.title" cols="12" sm="6" md="4">
          <!-- lg="2" for 6 cards in a row on large screens, adjust as needed -->
          <v-card :color="metric.color" theme="dark" class="fill-height metric-card">
            <v-card-text class="d-flex flex-column justify-space-between" style="min-height: 150px;">
              <div>
                <v-icon size="36" class="mb-2">{{ metric.icon }}</v-icon>
                <div class="text-overline font-weight-bold metric-title">{{ metric.title }}</div>
              </div>
              <div class="text-h3 font-weight-bold align-self-end">{{ metric.value }}</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Transaction Alerts Section - NEW -->
      <v-row class="mt-10">
        <v-col cols="12">
          <h2 class="text-h5 font-weight-medium mb-4">Transaction Alerts</h2>
        </v-col>
        <v-col v-for="alertItem in transactionAlerts" :key="alertItem.title" cols="12" md="4">
          <v-card class="fill-height alert-card" :to="alertItem.linkTo" hover>
            <v-list-item :prepend-icon="alertItem.icon" :base-color="alertItem.color">
              <v-list-item-title class="text-h6 font-weight-medium">{{ alertItem.title }}</v-list-item-title>
              <v-list-item-subtitle>{{ alertItem.subtext }}</v-list-item-subtitle>
               <template v-slot:append>
                <v-chip :color="alertItem.color" label size="large" class="font-weight-bold">
                  {{ alertItem.count }}
                </v-chip>
              </template>
            </v-list-item>
            <!-- Optional: Display a few recent items if API provides them -->
            
            <v-list lines="one" density="compact" v-if="alertItem.recentItems && alertItem.recentItems.length > 0">
              <v-list-item v-for="item in alertItem.recentItems.slice(0, 3)" :key="item._id" :to="`${alertItem.linkTo}/${item._id}`">
                <v-list-item-title class="text-truncate">{{ item.name || item.request_type || item.item_borrowed }}</v-list-item-title>
                <v-list-item-subtitle class="text-truncate">{{ item.requestor_name || item.complainant_display_name || item.borrower_name }}</v-list-item-subtitle>
                 <template v-slot:append>
                   <v-icon size="small">mdi-chevron-right</v-icon>
                 </template>
              </v-list-item>
              <v-divider v-if="alertItem.count > 3"></v-divider>
              <v-list-item :to="alertItem.linkTo" class="text-center text-caption" v-if="alertItem.count > 0">
                View All {{ alertItem.title.toLowerCase() }}...
              </v-list-item>
            </v-list>
            <v-card-text v-else-if="alertItem.count === 0" class="text-center text-grey">
                No {{ alertItem.title.toLowerCase() }}.
            </v-card-text>
           
          </v-card>
        </v-col>
      </v-row>

      <!-- Age Brackets Card - REMOVED -->
      <!-- Quick Navigation Links - REMOVED as per request, replaced by Transaction Alerts -->

    </div>
  </v-container>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useCookie } from '#app'; // For user data
import { useMyFetch } from '../composables/useMyFetch'; // Adjust path as needed
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const userData = useCookie('userData'); // Assuming 'name' property exists
const loading = ref(true);
const error = ref(false);

// Refs for dashboard data from API
const apiData = ref({
  totalPopulation: 0,
  totalHouseholds: 0,
  totalRegisteredVoters: 0,
  totalSeniorCitizens: 0,
  totalPWDs: 0,
  totalLaborForce: 0,
  totalUnemployed: 0,
  totalOutOfSchoolYouth: 0,
  pendingDocumentRequestsCount: 0,
  newComplaintsCount: 0,
  borrowedAssetsNotReturnedCount: 0,
  recentPendingDocumentRequests: [], // If fetching recent items
  recentNewComplaints: [],
  recentBorrowedAssets: [],
});

onMounted(async () => {
  loading.value = true;
  error.value = false;
  try {
    const { data: dashboardData, error: fetchError } = await useMyFetch('/api/dashboard');

    if (fetchError.value || !dashboardData.value) {
      console.error('Failed to fetch dashboard metrics:', fetchError.value);
      error.value = true;
      $toast.fire({ title: 'Could not load dashboard data.', icon: 'error'});
    } else {
      apiData.value = { ...apiData.value, ...dashboardData.value }; // Merge fetched data into apiData
    }
  } catch (e) {
    console.error('Exception fetching dashboard metrics:', e);
    error.value = true;
    $toast.fire({ title: 'An error occurred loading dashboard.', icon: 'error'});
  } finally {
    loading.value = false;
  }
});

const mainMetrics = computed(() => [
  { title: 'POPULATION', value: apiData.value.totalPopulation, icon: 'mdi-account-group-outline', color: 'blue-darken-2' },
  { title: 'HOUSEHOLDS', value: apiData.value.totalHouseholds, icon: 'mdi-home-city-outline', color: 'deep-purple-darken-1' },
  { title: 'VOTERS', value: apiData.value.totalRegisteredVoters, icon: 'mdi-account-check-outline', color: 'light-blue-darken-3' },
  { title: 'SENIORS', value: apiData.value.totalSeniorCitizens, icon: 'mdi-human-cane', color: 'teal-darken-1' },
  { title: 'PWDs', value: apiData.value.totalPWDs, icon: 'mdi-wheelchair-accessibility', color: 'indigo-darken-1' },
  // More granular occupation status can be added here or in a separate section
  { title: 'LABOR FORCE', value: apiData.value.totalLaborForce, icon: 'mdi-briefcase-outline', color: 'green-darken-2' },
  { title: 'UNEMPLOYED', value: apiData.value.totalUnemployed, icon: 'mdi-account-off-outline', color: 'amber-darken-2' },
  { title: 'OUT OF SCHOOL YOUTH', value: apiData.value.totalOutOfSchoolYouth, icon: 'mdi-school-outline', subicon: 'mdi-cancel', color: 'orange-darken-2' },
]);

const transactionAlerts = computed(() => [
  {
    title: 'Pending Document Requests',
    count: apiData.value.pendingDocumentRequestsCount,
    icon: 'mdi-file-document-edit-outline',
    color: 'warning', // Vuetify color name
    subtext: 'Awaiting processing or approval.',
    linkTo: '/document-requests?status=Pending', // Example link to filtered list
    // recentItems: apiData.value.recentPendingDocumentRequests
  },
  {
    title: 'New Complaints Filed',
    count: apiData.value.newComplaintsCount,
    icon: 'mdi-comment-alert-outline',
    color: 'error',
    subtext: 'Require investigation or action.',
    linkTo: '/complaints?status=New',
    // recentItems: apiData.value.recentNewComplaints
  },
  {
    title: 'Assets Currently Borrowed',
    count: apiData.value.borrowedAssetsNotReturnedCount,
    icon: 'mdi-archive-arrow-up-outline',
    color: 'info',
    subtext: 'Items that are out and not yet returned.',
    linkTo: '/borrowed-assets?status=Borrowed,Overdue', // Link to items borrowed or overdue
    recentItems: apiData.value.recentBorrowedAssets
  },
]);

</script>

<style scoped>
.metric-card {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}
.metric-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 25px rgba(0,0,0,0.15) !important;
}
.metric-title {
    font-size: 0.8rem !important; /* Make overline smaller */
    line-height: 1.2;
    margin-bottom: 4px;
}
.alert-card {
    transition: box-shadow 0.2s ease-in-out;
}
.alert-card:hover {
    box-shadow: 0 6px 15px rgba(0,0,0,0.1) !important;
}
.v-list-item-subtitle {
    white-space: normal; /* Allow subtitle to wrap if needed */
}
</style>