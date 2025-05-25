<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-6">
      <v-col><h2>Add New Notification</h2></v-col>
      <v-col class="text-right">
        <v-btn
          color="primary"
          @click="saveNotification"
          prepend-icon="mdi-content-save"
          variant="tonal"
          :loading="saving"
          size="large"
        >
          Save Notification
        </v-btn>
      </v-col>
    </v-row>

    <v-card prepend-icon="mdi-bell-plus-outline" title="Notification Details">
      <v-card-text>
        <v-form ref="form">
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="notification.name"
                label="Notification Name/Title"
                :rules="[rules.required, rules.nameLength]"
                variant="outlined"
                density="compact"
                required
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="notification.by"
                label="Author (Admin Name)"
                :rules="[rules.required]"
                variant="outlined"
                density="compact"
                required
              ></v-text-field>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12">
              <v-textarea
                v-model="notification.content"
                label="Notification Content"
                :rules="[rules.required, rules.contentLength]"
                variant="outlined"
                rows="5"
                auto-grow
                required
              ></v-textarea>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="notification.date"
                label="Notification Date & Time"
                type="datetime-local"
                :rules="[rules.required]"
                variant="outlined"
                density="compact"
                required
              ></v-text-field>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useMyFetch } from '../../composables/useMyFetch'; // Adjust path
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const router = useRouter();
const form = ref(null); // For v-form validation

const notification = ref({
  name: '',
  content: '',
  date: new Date().toISOString().slice(0, 16), // Default to current date & time for datetime-local
  by: '', // Prefill with logged-in admin name if possible
});
const saving = ref(false);

const rules = {
  required: value => !!value || 'This field is required.',
  nameLength: value => (value && value.length <= 100) || 'Name must be less than 100 characters.',
  contentLength: value => (value && value.length <= 1000) || 'Content must be less than 1000 characters.',
};

async function saveNotification() {
  const { valid } = await form.value.validate();
  if (!valid) {
    $toast.fire({ title: 'Please correct the form errors.', icon: 'error' });
    return;
  }

  saving.value = true;
  try {
    const payload = {
      ...notification.value,
      date: new Date(notification.value.date).toISOString(), // Ensure it's ISO format for backend
    };

    const { data, error } = await useMyFetch('/api/notifications', {
      method: 'POST',
      body: payload,
    });

    if (error.value || data.value?.error) {
      $toast.fire({ title: data.value?.error || 'Failed to add notification', icon: 'error' });
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