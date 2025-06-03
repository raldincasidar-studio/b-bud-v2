<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-6">
      <v-col><h2>Add New Notification</h2></v-col>
      <v-col class="text-right">
        <v-btn color="primary" @click="saveNotification" prepend-icon="mdi-content-save" variant="tonal" :loading="saving" size="large">
          Save Notification
        </v-btn>
      </v-col>
    </v-row>

    <v-card prepend-icon="mdi-bell-plus-outline" title="Notification Details">
      <v-card-text>
        <v-form ref="form">
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field v-model="notification.name" label="Notification Name/Title*" :rules="[rules.required, rules.nameLength]" variant="outlined" density="compact"></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="notification.by" label="Author (e.g., Admin Name)*" :rules="[rules.required]" variant="outlined" density="compact"></v-text-field>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12" md="6">
              <v-select
                v-model="notification.type"
                :items="NOTIFICATION_TYPES"
                label="Notification Type*"
                :rules="[rules.required]"
                variant="outlined"
                density="compact"
              ></v-select>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="notification.date" label="Effective Date & Time*" type="datetime-local" :rules="[rules.required]" variant="outlined" density="compact"></v-text-field>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <v-textarea v-model="notification.content" label="Notification Content*" :rules="[rules.required, rules.contentLength]" variant="outlined" rows="5" auto-grow></v-textarea>
            </v-col>
          </v-row>

          <v-divider class="my-4"></v-divider>
          <h3>Targeting</h3>

          <v-row>
            <v-col cols="12" md="6">
              <v-select
                v-model="notification.target_audience"
                :items="TARGET_AUDIENCE_OPTIONS"
                label="Target Audience*"
                :rules="[rules.required]"
                variant="outlined"
                density="compact"
              ></v-select>
            </v-col>
          </v-row>

          <v-row v-if="notification.target_audience === 'SpecificResidents'">
            <v-col cols="12">
              <v-autocomplete
                v-model="selectedRecipientIds"
                :items="searchedResidents"
                :loading="isSearchingResidents"
                :search-input.sync="residentSearchQuery"
                chips
                closable-chips
                multiple
                item-title="displayName"
                item-value="_id"
                label="Select Specific Residents (Type to search)"
                placeholder="Search by name or email..."
                variant="outlined"
                density="compact"
                no-filter 
                hide-no-data
                @update:search="debouncedSearchResidents"
              >
                <template v-slot:chip="{ props, item }">
                  <v-chip v-bind="props" :text="item.raw.displayName"></v-chip>
                </template>
                <template v-slot:item="{ props, item }">
                  <v-list-item v-bind="props" :title="item.raw.displayName" :subtitle="item.raw.email"></v-list-item>
                </template>
                 <template v-slot:no-data>
                  <v-list-item v-if="residentSearchQuery && residentSearchQuery.length > 1 && !isSearchingResidents">
                    <v-list-item-title>
                      No residents found matching "<strong>{{ residentSearchQuery }}</strong>".
                    </v-list-item-title>
                  </v-list-item>
                </template>
              </v-autocomplete>
              <small v-if="notification.target_audience === 'SpecificResidents' && selectedRecipientIds.length === 0" class="text-error">
                Please select at least one resident if targeting specific residents.
              </small>
            </v-col>
          </v-row>
           <small v-if="notification.target_audience === 'All'" class="d-block mt-2 text-info">
              This notification will be sent to all 'Approved' residents.
            </small>


        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useMyFetch } from '../../composables/useMyFetch'; // Adjust path
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const router = useRouter();
const form = ref(null);

const NOTIFICATION_TYPES = ['Announcement', 'Alert', 'Notification'];
const TARGET_AUDIENCE_OPTIONS = [
  { title: 'All Approved Residents', value: 'All' },
  { title: 'Specific Residents', value: 'SpecificResidents' },
  // Add more target groups here if your API supports them, e.g.:
  // { title: 'Household Heads', value: 'HouseholdHeads' },
];


const userData = useCookie('userData');

const notification = ref({
  name: '',
  content: '',
  date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16), // Default to current local time
  by: userData.value.name, // TODO: Prefill with logged-in admin's name
  type: NOTIFICATION_TYPES[0], // Default type
  target_audience: TARGET_AUDIENCE_OPTIONS[0].value, // Default target
  // recipient_ids will be derived from selectedRecipientIds
});
const saving = ref(false);

// For specific resident selection
const selectedRecipientIds = ref([]); // Stores ObjectIds of selected residents
const residentSearchQuery = ref('');
const searchedResidents = ref([]); // Results from API for autocomplete
const isSearchingResidents = ref(false);
let searchDebounceTimer = null;

const rules = {
  required: value => !!value || 'This field is required.',
  nameLength: value => (value && value.length <= 100) || 'Title must be less than 100 characters.',
  contentLength: value => (value && value.length <= 1000) || 'Content must be less than 1000 characters.',
};

watch(() => notification.value.target_audience, (newVal) => {
  if (newVal !== 'SpecificResidents') {
    selectedRecipientIds.value = []; // Clear specific recipients if target changes
    residentSearchQuery.value = '';
    searchedResidents.value = [];
  }
});

const searchResidentsAPI = async (query) => {
  if (!query || query.trim().length < 2) {
    searchedResidents.value = [];
    isSearchingResidents.value = false;
    return;
  }
  isSearchingResidents.value = true;
  try {
    const { data, error } = await useMyFetch('/api/residents/search', {
      query: { q: query, limit: 15 }, // Limit results for autocomplete
    });
    if (error.value) {
      console.error('Error searching residents:', error.value);
      searchedResidents.value = [];
    } else {
      searchedResidents.value = (data.value?.residents || []).map(r => ({
        ...r,
        displayName: `${r.first_name} ${r.last_name || ''} (${r.email})`,
      }));
    }
  } catch (e) {
    console.error('Exception searching residents:', e);
    searchedResidents.value = [];
  } finally {
    isSearchingResidents.value = false;
  }
};

const debouncedSearchResidents = (query) => {
  clearTimeout(searchDebounceTimer);
  if (query && query.length > 1) {
    isSearchingResidents.value = true; // Show loading early
    searchDebounceTimer = setTimeout(() => {
      searchResidentsAPI(query);
    }, 500);
  } else {
    searchedResidents.value = [];
    isSearchingResidents.value = false;
  }
};


async function saveNotification() {
  const { valid } = await form.value.validate();
  if (!valid) {
    $toast.fire({ title: 'Please correct the form errors.', icon: 'error' });
    return;
  }

  if (notification.value.target_audience === 'SpecificResidents' && selectedRecipientIds.value.length === 0) {
    $toast.fire({ title: 'Please select at least one resident for specific targeting.', icon: 'error' });
    return;
  }

  saving.value = true;
  try {
    const payload = {
      ...notification.value,
      date: new Date(notification.value.date).toISOString(),
      recipient_ids: notification.value.target_audience === 'SpecificResidents' ? selectedRecipientIds.value : [], // Send selected IDs or empty if 'All'
    };
    // The API will handle populating recipients for 'All'

    const { data, error } = await useMyFetch('/api/notifications', {
      method: 'POST',
      body: payload,
    });

    if (error.value || data.value?.error) {
      $toast.fire({ title: data.value?.message || data.value?.error || 'Failed to add notification', icon: 'error' });
    } else {
      $toast.fire({ title: 'Notification added successfully!', icon: 'success' });
      router.push('/notifications');
    }
  } catch (e) {
    console.error("Exception saving notification:", e);
    $toast.fire({ title: 'An error occurred while saving.', icon: 'error' });
  } finally {
    saving.value = false;
  }
}
</script>