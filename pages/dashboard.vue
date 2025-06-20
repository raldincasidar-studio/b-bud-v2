<template>
  <v-container class="my-12">
    <div class="d-flex flex-column justify-center align-center mb-10">
      <h1 class="text-h1  mx-2">
        <!-- MODIFIED: Use the reactive computed property for the time -->
        {{ formattedTime }}
      </h1>
      <h2 class="text-subtitle-1 mx-2">
        <!-- MODIFIED: Use the reactive computed property for the date -->
        {{ formattedDate }}
      </h2>
    </div>


    <v-row justify="space-between" align="center" class="mb-8">
      <v-col cols="auto">
        <h1 class="text-h3 font-weight-bold mb-2">Dashboard Overview</h1>
        <h3 class="text-subtitle-1 text-grey-darken-1">
          Welcome {{ userData?.name || 'Admin' }}! Current community and transaction status.
        </h3>
      </v-col>
      <v-col cols="auto">
        <v-img src="@/assets/img/logo.png" width="100" contain></v-img>
      </v-col>
    </v-row>

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
        <v-col cols="12">
          <v-btn block size="large" color="primary" prepend-icon="mdi-printer" href="/printable/dashboard" target="_blank">PRINT STATISTICS</v-btn>
        </v-col>
        <v-col v-for="metric in mainMetrics" :key="metric.title" cols="12" sm="6" md="4">
          <v-card
            :color="metric.color"
            theme="dark"
            class="fill-height metric-card"
            :to="metric.linkTo"  
            hover
          >
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

      <!-- Age Distribution Metrics -->
      <v-row>
        <v-col cols="12">
            <v-card>
              <v-card-item>
                <v-card-title>Age Distribution</v-card-title>
                <v-card-subtitle>Population count by age bracket</v-card-subtitle>
              </v-card-item>

              <v-card-text>
                <div v-if="loading" class="text-center pa-10">
                  <v-progress-circular indeterminate color="primary"></v-progress-circular>
                  <p class="mt-2 text-grey-darken-1">Loading Chart Data...</p>
                </div>

                <v-alert
                  v-else-if="error"
                  type="warning"
                  variant="tonal"
                  icon="mdi-alert-outline"
                  text="Could not load the age distribution data."
                ></v-alert>

                <div v-else>
                  <!-- The ApexChart component -->
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
            
            <v-list lines="one" density="compact" v-if="alertItem.recentItems && alertItem.recentItems.length > 0">
              <v-list-item v-for="item in alertItem.recentItems.slice(0, 3)" :key="item._id" :to="`${alertItem.itemLinkPrefix}/${item._id}`">
                <v-list-item-title class="text-truncate">{{ item.name || item.request_type || item.item_borrowed || 'Untitled Item' }}</v-list-item-title>
                <!-- REVISED: Added 'item.dateAdded' to the subtitle chain for pending residents -->
                <v-list-item-subtitle class="text-truncate">{{ item.requestor_name || item.complainant_display_name || item.borrower_name || item.dateAdded || 'N/A' }}</v-list-item-subtitle>
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
    </div>
  </v-container>
</template>

<script setup>
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
    linkTo: '/residents?status=Pending',
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