<template>
    <v-layout class="rounded rounded-md border">
        <v-navigation-drawer v-model="drawer">
            <v-list>
                <v-list-item
                    prepend-icon="mdi-account"
                    :subtitle="userData?.role"
                    :title="userData?.name"
                >
                    <!-- <template v-slot:append>
                    <v-btn
                        icon="mdi-menu-down"
                        size="medium"
                        variant="text"
                    ></v-btn>
                    </template> -->
                </v-list-item>
                </v-list>

                <v-divider></v-divider>

                <v-list
                :lines="false"
                nav
                >
                <v-list-item
                    v-for="(item, i) in itemsFiltered"
                    :to="item.to"
                    :key="i"
                    :value="item"
                    color="primary"
                >
                    <template v-slot:prepend>
                        <v-icon :icon="item.icon"></v-icon>
                    </template>

                    <!-- Display the original text for the main title -->
                    <v-list-item-title>{{ item.originalText }}</v-list-item-title>

                    <!-- Use v-slot:append for the styled count, aligned to the right -->
                    <template v-if="item.count !== null && item.count > 0" v-slot:append>
                        <v-chip color="red" size="x-small" label class="font-weight-bold">
                            {{ item.count }}
                        </v-chip>
                    </template>
                </v-list-item>
                <v-list-item
                    @click="logout()"
                    color="primary"
                >
                    <template v-slot:prepend>
                        <v-icon icon="mdi-logout"></v-icon>
                    </template>

                    <v-list-item-title v-text="'Logout'"></v-list-item-title>
                </v-list-item>
            </v-list>
        </v-navigation-drawer>

        <v-app-bar color="primary">
            <v-app-bar-nav-icon variant="text" @click.stop="drawer = !drawer"></v-app-bar-nav-icon>
            <v-toolbar-title>B-Bud</v-toolbar-title>
        </v-app-bar>

        <v-main>
            <slot />
        </v-main>
    </v-layout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useCookie, useRouter } from '#app';
import { useMyFetch } from '../composables/useMyFetch'; // Adjust path if necessary based on your project structure

const userData = useCookie('userData');

const drawer = ref(false);

// Refs to store the counts of transactions being processed
const documentRequestCount = ref(null);
const borrowedAssetsCount = ref(null);
const filedComplaintsCount = ref(null);

const items = [
    { to: '/dashboard', text: 'Dashboard', icon: 'mdi-speedometer' },
    { to: '/residents-account-management', text: 'Household Account Management', icon: 'mdi-account-cog-outline' },
    { to: '/residents', text: 'Residents Profile', icon: 'mdi-account-group' },
    { to: '/households', text: 'Households', icon: 'mdi-home-group' },
    { to: '/document-requests', text: 'Document Requests', icon: 'mdi-file-document' },
    { to: '/borrowed-assets', text: 'Borrowed Assets', icon: 'mdi-archive-arrow-down-outline' },
    { to: '/complaints', text: 'Filed Complaints', icon: 'mdi-comment-alert-outline' },
    { to: '/notifications', text: 'Announcements', icon: 'mdi-bell-ring' },
    { to: '/barangay-officials', text: 'Barangay Officials', icon: 'mdi-bank' },
    { to: '/assets', text: 'Inventory', icon: 'mdi-archive-search-outline' },
    { to: '/budget-management', text: 'Budget Management', icon: 'mdi-currency-usd', superAdmin: true },
    { to: '/admins', text: 'Admin Management', icon: 'mdi-shield-account', superAdmin: true },
    { to: '/admins/' + userData.value?._id, text: 'My Account', icon: 'mdi-account-circle' },
    { to: '/audit-logs', text: 'Audit Log', icon: 'mdi-file-document-outline', superAdmin: true },
];

const router = useRouter();
async function logout() {
    userData.value = null;
    router.replace('/')
}

// Function to fetch counts for all specified statuses
async function fetchCounts() {
    try {
        // --- Document Requests ---
        let drTotal = 0;
        const drStatuses = ['Pending', 'Processing', 'Approved', 'Ready for Pickup', 'Released', 'Declined'];
        for (const status of drStatuses) {
            const { data, error } = await useMyFetch('/api/document-requests', { query: { status: status, itemsPerPage: 1 } });
            if (!error.value) {
                drTotal += data.value?.total || 0;
            } else {
                console.error(`Error fetching Document Request - ${status} count:`, error.value?.message);
            }
        }
        documentRequestCount.value = drTotal;

        // --- Borrowed Assets ---
        let baTotal = 0;
        const baStatuses = ['Pending', 'Processing', 'Approved', 'Returned', 'Overdue', 'Lost', 'Damaged', 'Resolved', 'Rejected'];
        for (const status of baStatuses) {
            const { data, error } = await useMyFetch('/api/borrowed-assets', { query: { status: status, itemsPerPage: 1 } });
            if (!error.value) {
                baTotal += data.value?.total || 0;
            } else {
                console.error(`Error fetching Borrowed Asset - ${status} count:`, error.value?.message);
            }
        }
        borrowedAssetsCount.value = baTotal;

        // --- Filed Complaints ---
        let fcTotal = 0;
        const fcStatuses = ['New', 'Under Investigation', 'Unresolved', 'Resolved', 'Closed', 'Dismissed'];
        for (const status of fcStatuses) {
            const { data, error } = await useMyFetch('/api/complaints', { query: { status: status, itemsPerPage: 1 } });
            if (!error.value) {
                fcTotal += data.value?.total || 0;
            } else {
                console.error(`Error fetching Filed Complaint - ${status} count:`, error.value?.message);
            }
        }
        filedComplaintsCount.value = fcTotal;

    } catch (e) {
        console.error('An unexpected error occurred in `fetchCounts`:', e);
        // Ensure counts are reset on any unhandled error to prevent UI issues
        documentRequestCount.value = 0;
        borrowedAssetsCount.value = 0;
        filedComplaintsCount.value = 0;
    }
}

// Fetch counts when the component is mounted
onMounted(() => {
    fetchCounts();
});

const itemsFiltered = computed(() => {
    // Filter items based on superAdmin role
    const filtered = items.filter(item => !item.superAdmin || userData.value?.role === 'Super Admin');

    // Map over filtered items to append counts
    return filtered.map(item => {
        let count = null;
        let originalText = item.text; // Preserve original text

        // Assign counts to specific items if fetched
        if (item.to === '/document-requests') {
            count = documentRequestCount.value;
        } else if (item.to === '/borrowed-assets') {
            count = borrowedAssetsCount.value;
        } else if (item.to === '/complaints') {
            count = filedComplaintsCount.value;
        }
        
        // Return a new object with all original properties, plus originalText and count
        return { ...item, originalText: originalText, count: count };
    });
});
</script>