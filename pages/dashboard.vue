<template>
  <v-container class="my-12" role="main">
    <div class="d-flex flex-column justify-center align-center mb-10" role="timer" aria-live="polite">
      <!-- ACCESSIBILITY FIX: Changed h1 to a p tag to ensure only one h1 exists on the page. Screen readers can still identify it by its explicit label. -->
      <p class="text-h1 mx-2" aria-label="Current time">
        {{ formattedTime }}
      </p>
      <!-- ACCESSIBILITY FIX: Changed h2 to a p tag to maintain a logical heading order. -->
      <p class="text-subtitle-1 mx-2" aria-label="Current date">
        {{ formattedDate }}
      </p>
    </div>


    <v-row justify="space-between" align="center" class="mb-8">
      <v-col cols="auto">
        <!-- ACCESSIBILITY FIX: This is now the main heading of the page. -->
        <h1 class="text-h3 font-weight-bold mb-2">Dashboard Overview</h1>
        <!-- ACCESSIBILITY FIX: Changed h3 to h2 for proper heading hierarchy. -->
        <h2 class="text-subtitle-1 text-grey-darken-1">
          Welcome {{ userData?.name || 'Admin' }}! Current community and transaction status.
        </h2>
      </v-col>
      <v-col cols="auto">
        <!-- ACCESSIBILITY FIX: Added a descriptive alt attribute for the image. -->
        <v-img src="@/assets/img/logo.png" width="100" contain alt="Community Logo"></v-img>
      </v-col>
    </v-row>

    <!-- ACCESSIBILITY FIX: Added role="status" to announce loading state to screen readers. -->
    <div v-if="loading" class="text-center pa-10" role="status">
      <v-progress-circular indeterminate color="primary" size="64" aria-label="Loading dashboard metrics"></v-progress-circular>
      <p class="mt-4">Loading dashboard metrics...</p>
    </div>
    <!-- ACCESSIBILITY FIX: Added role="alert" for better error announcement. -->
    <div v-else-if="error" class="text-center pa-10" role="alert">
      <v-alert type="error" prominent border="start" icon="mdi-alert-circle-outline">
        Failed to load dashboard metrics. Please try again later.
      </v-alert>
    </div>

    <div v-else>
      <!-- Main Metric Cards - REVISED -->
      <v-row>
        <v-col cols="12">
           <!-- ACCESSIBILITY FIX: Added aria-label for a more descriptive button. -->
          <v-btn block size="large" color="primary" prepend-icon="mdi-printer" href="/printable/dashboard" target="_blank" aria-label="Print dashboard statistics">PRINT STATISTICS</v-btn>
        </v-col>
        <v-col v-for="metric in mainMetrics" :key="metric.title" cols="12" sm="6" md="4">
          <v-card
            :color="metric.color"
            theme="dark"
            class="fill-height metric-card"
            :to="metric.linkTo"  
            hover
            :aria-label="`${metric.title}: ${metric.value}. Click to view more details.`"
          >
            <v-card-text class="d-flex flex-column justify-space-between" style="min-height: 150px;">
              <div>
                <!-- ACCESSIBILITY FIX: Hide decorative icon from screen readers. -->
                <v-icon size="36" class="mb-2" aria-hidden="true">{{ metric.icon }}</v-icon>
                <div class="text-overline font-weight-bold metric-title">{{ metric.title }}</div>
              </div>
              <!-- ACCESSIBILITY FIX: Hide value from screen readers as it's already in the card's aria-label. -->
              <div class="text-h3 font-weight-bold align-self-end" aria-hidden="true">{{ metric.value }}</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Age Distribution Metrics -->
      <v-row>
        <v-col cols="12">
            <v-card>
              <v-card-item>
                <v-card-title>
                  <!-- ACCESSIBILITY FIX: Added a proper h2 heading inside the card title. -->
                  <h2 class="text-h5">Age Distribution</h2>
                </v-card-title>
                <v-card-subtitle>Population count by age bracket</v-card-subtitle>
              </v-card-item>

              <v-card-text>
                <div v-if="loading" class="text-center pa-10" role="status">
                  <v-progress-circular indeterminate color="primary" aria-label="Loading chart data"></v-progress-circular>
                  <p class="mt-2 text-grey-darken-1">Loading Chart Data...</p>
                </div>

                <v-alert
                  v-else-if="error"
                  type="warning"
                  variant="tonal"
                  icon="mdi-alert-outline"
                  text="Could not load the age distribution data."
                  role="alert"
                ></v-alert>

                <!-- ACCESSIBILITY FIX: Added role="figure" and an aria-label to describe the chart. -->
                <div v-else role="figure" aria-label="Bar chart showing population count by age bracket.">
                  <apexchart
                    type="bar"
                    height="350"
                    :options="chartOptions"
                    :series="chartSeries"
                  ></apexchart>
                </div>
              </v-card-text>
            </v-card>
        </v-col>
      </v-row>

      <!-- Transaction Alerts Section - REVISED to include pending residents -->
      <v-row class="mt-10">
        <v-col cols="12">
          <h2 class="text-h5 font-weight-medium mb-4">Transaction Alerts</h2>
        </v-col>
        <v-col v-for="alertItem in transactionAlerts" :key="alertItem.title" cols="12" md="4">
           <!-- ACCESSIBILITY FIX: Added a comprehensive aria-label to describe the link card's purpose and status. -->
          <v-card class="fill-height alert-card" :to="alertItem.linkTo" hover :aria-label="`${alertItem.title}: ${alertItem.count} items. ${alertItem.subtext}`">
            <v-list-item :prepend-icon="alertItem.icon" :base-color="alertItem.color">
              <v-list-item-title class="text-h6 font-weight-medium">{{ alertItem.title }}</v-list-item-title>
              <v-list-item-subtitle>{{ alertItem.subtext }}</v-list-item-subtitle>
               <template v-slot:append>
                <!-- ACCESSIBILITY FIX: Hide chip from screen readers to avoid redundancy with the card's aria-label. -->
                <v-chip :color="alertItem.color" label size="large" class="font-weight-bold" aria-hidden="true">
                  {{ alertItem.count }}
                </v-chip>
              </template>
            </v-list-item>
            
            <v-list lines="one"  v-if="alertItem.recentItems && alertItem.recentItems.length > 0">
              <v-list-item v-for="item in alertItem.recentItems.slice(0, 3)" :key="item._id" :to="`${alertItem.itemLinkPrefix}/${item._id}`">
  
                <v-list-item-title class="text-truncate">
                  {{ item.category || item.request_type || (item.item_borrowed && item.quantity_borrowed ? `${item.item_borrowed} - ${item.quantity_borrowed}` : item.item_borrowed) || item.name || 'Untitled Item' }}
                </v-list-item-title>

                <v-list-item-subtitle class="text-truncate">
                  {{ item.complainant_display_name || item.requestor_name || item.borrower_name || item.requestor || item.borrower || ( (item.created_at || item.date_of_request || item.dateAdded || item.borrow_datetime) ? new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).format(new Date(item.created_at || item.date_of_request || item.dateAdded || item.borrow_datetime)) : '' ) }}
                </v-list-item-subtitle>

                <template v-slot:append>
                  <!-- ACCESSIBILITY FIX: Hide decorative icon from screen readers. -->
                  <v-icon size="small" aria-hidden="true">mdi-chevron-right</v-icon>
                </template>
              </v-list-item>
            </v-list>
            <v-card-text v-else-if="alertItem.count === 0" class="text-center text-grey">
                No {{ alertItem.title.toLowerCase() }}.
            </v-card-text>
           
          </v-card>
        </v-col>
      </v-row>
    </div>
  </v-container>
</template>

<script setup>
// The script setup remains the same as no accessibility issues were identified in the logic.
import { ref, onMounted, computed, onUnmounted } from 'vue'; 
import { useCookie } from '#app';
import { useMyFetch } from '../composables/useMyFetch';
import { useNuxtApp } from '#app';
import VueApexCharts from 'vue3-apexcharts';
const apexchart = VueApexCharts;

const { $toast } = useNuxtApp();
const userData = useCookie('userData');
const loading = ref(true);
const error = ref(false);

const currentTime = ref(new Date());
let timer = null; 

const formattedTime = computed(() => {
  return new Intl.DateTimeFormat('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: true 
  }).format(currentTime.value);
});

const formattedDate = computed(() => {
  return new Intl.DateTimeFormat('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }).format(currentTime.value);
});

// REVISED: Refs for dashboard data from API now include pending resident fields
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
  pendingResidentsCount: 0, // ADDED: Count for pending residents
  recentPendingDocumentRequests: [],
  recentNewComplaints: [],
  recentBorrowedAssets: [],
  recentPendingResidents: [], // ADDED: Array for recent pending residents
});

const ageData = ref([]);

onMounted(async () => {
  timer = setInterval(() => {
    currentTime.value = new Date();
  }, 1000);

  loading.value = true;
  error.value = false;
  try {
    const { data: dashboardData, error: fetchError } = await useMyFetch('/api/dashboard');

    if (fetchError.value || !dashboardData.value) {
      console.error('Failed to fetch dashboard metrics:', fetchError.value);
      error.value = true;
      $toast.fire({ title: 'Could not load dashboard data.', icon: 'error'});
    } else {
      apiData.value = { ...apiData.value, ...dashboardData.value };
    }

    const { data, error: fetchError2 } = await useMyFetch('/api/dashboard/age-distribution');

    if (fetchError2.value || !data.value?.ageDistribution) {
      console.error('Failed to fetch age distribution:', fetchError.value);
      error.value = true;
    } else {
      ageData.value = data.value.ageDistribution;
    }
  } catch (e) {
    console.error('Exception fetching dashboard metrics:', e);
    error.value = true;
    $toast.fire({ title: 'An error occurred loading dashboard.', icon: 'error'});
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  clearInterval(timer);
});


const router = useRouter();

const handleBarClick = (event, chartContext, config) => {
  const dataPointIndex = config.dataPointIndex;
  if (dataPointIndex < 0 || !ageData.value[dataPointIndex]) return;

  const clickedBracket = ageData.value[dataPointIndex];
  router.push(`/residents?minAge=${clickedBracket.minAge}&maxAge=${clickedBracket.maxAge}`);
};

const chartSeries = computed(() => [
  {
    name: 'Population',
    data: ageData.value.map(item => item.count),
  },
]);

const chartOptions = computed(() => ({
  chart: {
    type: 'bar',
    height: 350,
    toolbar: {
      show: false,
    },
    events: {
      dataPointSelection: handleBarClick,
    },
  },
  plotOptions: {
    bar: {
      columnWidth: '60%',
      distributed: true,
      borderRadius: 4,
    },
  },
  dataLabels: {
    enabled: false,
  },
  legend: {
    show: false,
  },
  xaxis: {
    categories: ageData.value.map(item => item.bracket),
    labels: {
      style: {
        fontSize: '12px',
      },
    },
  },
  yaxis: {
    title: {
      text: 'Number of Residents',
    },
  },
  tooltip: {
    y: {
      formatter: (val) => `${val} residents`,
    },
  },
  colors: [
    '#3366CC', '#DC3912', '#FF9900', '#109618', '#990099', '#3B3EAC',
    '#0099C6', '#DD4477', '#66AA00', '#B82E2E',
  ],
}));

const mainMetrics = computed(() => [
  { title: 'POPULATION', value: apiData.value.totalPopulation, icon: 'mdi-account-group-outline', color: 'blue-darken-2', linkTo: '/residents' },
  { title: 'HOUSEHOLDS', value: apiData.value.totalHouseholds, icon: 'mdi-home-city-outline', color: 'deep-purple-darken-1', linkTo: '/households' },
  { title: 'VOTERS', value: apiData.value.totalRegisteredVoters, icon: 'mdi-account-check-outline', color: 'light-blue-darken-3', linkTo: '/residents?is_voter=true' },
  { title: 'SENIORS', value: apiData.value.totalSeniorCitizens, icon: 'mdi-human-cane', color: 'teal-darken-1', linkTo: '/residents?is_senior=true' },
  { title: 'PWDs', value: apiData.value.totalPWDs, icon: 'mdi-wheelchair-accessibility', color: 'indigo-darken-1', linkTo: '/residents?is_pwd=true' },
  { title: 'LABOR FORCE', value: apiData.value.totalLaborForce, icon: 'mdi-briefcase-outline', color: 'green-darken-2', linkTo: '/residents?occupation=Labor force' },
  { title: 'UNEMPLOYED', value: apiData.value.totalUnemployed, icon: 'mdi-account-off-outline', color: 'amber-darken-2', linkTo: '/residents?occupation=Unemployed' },
  { title: 'OUT OF SCHOOL YOUTH', value: apiData.value.totalOutOfSchoolYouth, icon: 'mdi-school-outline', color: 'orange-darken-2', linkTo: '/residents?occupation=Out of School Youth' },
]);

// REVISED: This computed property now includes the new alert for pending residents.
const transactionAlerts = computed(() => [
  {
    title: 'Pending Resident Approval',
    count: apiData.value.pendingResidentsCount,
    icon: 'mdi-account-clock-outline',
    color: 'blue-grey',
    subtext: 'New residents awaiting verification.',
    linkTo: '/residents-account-management?status=Pending',
    itemLinkPrefix: '/residents', 
    recentItems: apiData.value.recentPendingResidents,
  },
  {
    title: 'Pending Document Requests',
    count: apiData.value.pendingDocumentRequestsCount,
    icon: 'mdi-file-document-edit-outline',
    color: 'warning',
    subtext: 'Awaiting processing or approval.',
    linkTo: '/document-requests?status=Pending',
    itemLinkPrefix: '/document-requests',
    recentItems: apiData.value.recentPendingDocumentRequests,
  },
  {
    title: 'New Complaints Filed',
    count: apiData.value.newComplaintsCount,
    icon: 'mdi-comment-alert-outline',
    color: 'error',
    subtext: 'Require investigation or action.',
    linkTo: '/complaints?status=New',
    itemLinkPrefix: '/complaints',
    recentItems: apiData.value.recentNewComplaints,
  },
  {
    title: 'Assets Currently Borrowed',
    count: apiData.value.borrowedAssetsNotReturnedCount,
    icon: 'mdi-archive-arrow-up-outline',
    color: 'info',
    subtext: 'Items that are out and not yet returned.',
    linkTo: '/borrowed-assets?status=Borrowed,Overdue',
    itemLinkPrefix: '/borrowed-assets',
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
    font-size: 0.8rem !important;
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
    white-space: normal;
}
</style>