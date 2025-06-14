<template>
  <v-container class="my-10">
    <!-- Loading and Error States -->
    <div v-if="loading" class="text-center pa-10">
      <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
      <p class="mt-2 text-grey-darken-1">Loading Asset Data...</p>
    </div>
    <div v-else-if="!form.name">
      <v-alert type="warning" prominent border="start" text="Asset not found.">
        <template v-slot:append><v-btn to="/assets">Back to List</v-btn></template>
      </v-alert>
    </div>

    <!-- Main Content -->
    <div v-else>
      <v-row justify="space-between" align="center" class="mb-6">
        <v-col>
          <h2 class="text-h4 font-weight-bold">Edit Asset</h2>
          <p class="text-grey-darken-1">Update details for {{ form.name }}</p>
        </v-col>
        <v-col class="text-right">
          <v-btn v-if="!editMode" color="primary" @click="editMode = true" prepend-icon="mdi-pencil" class="mr-2">Edit</v-btn>
          <v-btn v-if="editMode" color="success" @click="saveChanges" prepend-icon="mdi-content-save" class="mr-2" :loading="saving">Save Changes</v-btn>
          <v-btn v-if="editMode" color="grey" @click="cancelEdit" prepend-icon="mdi-close-circle-outline" variant="text" class="mr-2">Cancel</v-btn>
          <v-btn color="error" @click="confirmDeleteDialog = true" prepend-icon="mdi-delete" variant="outlined" :loading="deleting">Delete</v-btn>
        </v-col>
      </v-row>

      <v-card class="mt-4" flat border>
        <v-card-text class="py-6">
          <v-row>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Asset Name <span v-if="editMode" class="text-red">*</span></label>
              <v-text-field
                v-model="form.name"
                :readonly="!editMode" variant="outlined"
                :error-messages="v$.name.$errors.map(e => e.$message)"
                @blur="v$.name.$touch"
              ></v-text-field>
            </v-col>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Category <span v-if="editMode" class="text-red">*</span></label>
              <v-text-field
                v-model="form.category"
                :readonly="!editMode" variant="outlined"
                :error-messages="v$.category.$errors.map(e => e.$message)"
                @blur="v$.category.$touch"
              ></v-text-field>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="12" md="6">
              <label class="v-label mb-1">Total Quantity <span v-if="editMode" class="text-red">*</span></label>
              <v-text-field
                v-model="form.total_quantity"
                type="number" :readonly="!editMode" variant="outlined"
                :error-messages="v$.total_quantity.$errors.map(e => e.$message)"
                @blur="v$.total_quantity.$touch"
                :min="0"
              ></v-text-field>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </div>

    <!-- Confirmation Dialog for Deletion -->
    <v-dialog v-model="confirmDeleteDialog" persistent max-width="400">
      <v-card>
        <v-card-title class="text-h5">Confirm Deletion</v-card-title>
        <v-card-text>Delete the asset <strong>{{ form.name }}</strong>? This action cannot be undone.</v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue-darken-1" variant="text" @click="confirmDeleteDialog = false">Cancel</v-btn>
          <v-btn color="red-darken-1" variant="text" @click="deleteAsset" :loading="deleting">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useVuelidate } from '@vuelidate/core';
import { required, minValue, numeric } from '@vuelidate/validators';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const assetId = route.params.id;

const form = reactive({ name: '', total_quantity: null, category: '' });
const originalFormState = ref({});
const loading = ref(true);
const editMode = ref(false);
const saving = ref(false);
const deleting = ref(false);
const confirmDeleteDialog = ref(false);

const rules = {
  name: { required },
  category: { required },
  total_quantity: { required, numeric, minValue: minValue(0) },
};
const v$ = useVuelidate(rules, form);

onMounted(async () => { await fetchAsset(); });

async function fetchAsset() {
  loading.value = true;
  try {
    const { data, error } = await useMyFetch(`/api/assets/${assetId}`);
    if (error.value) throw new Error('Asset not found or could not be loaded.');
    
    Object.assign(form, data.value.asset);
    originalFormState.value = JSON.parse(JSON.stringify(form));
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
    router.push('/assets');
  } finally {
    loading.value = false;
  }
}

const cancelEdit = () => {
    Object.assign(form, originalFormState.value);
    v$.value.$reset();
    editMode.value = false;
};

async function saveChanges() {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) { $toast.fire({ title: 'Please correct form errors.', icon: 'error' }); return; }
  
  saving.value = true;
  try {
    const { error } = await useMyFetch(`/api/assets/${assetId}`, {
        method: 'PUT',
        body: form,
    });
    if (error.value) throw new Error(error.value.data?.error || 'Failed to update asset.');
    
    $toast.fire({ title: 'Asset updated successfully!', icon: 'success' });
    await fetchAsset();
    editMode.value = false;
  } catch(e) { $toast.fire({ title: e.message, icon: 'error' }); }
  finally { saving.value = false; }
}

async function deleteAsset() {
  deleting.value = true;
  try {
    const { error } = await useMyFetch(`/api/assets/${assetId}`, { method: 'DELETE' });
    if (error.value) throw new Error('Failed to delete asset.');
    $toast.fire({ title: 'Asset deleted successfully!', icon: 'success' });
    router.push('/assets');
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    deleting.value = false;
    confirmDeleteDialog.value = false;
  }
}
</script>

<style scoped>
.v-label {
    opacity: 1;
    font-size: 0.875rem;
    color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
    display: block;
    margin-bottom: 4px;
    font-weight: 500;
}
</style>