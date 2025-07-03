<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-6">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Add New Asset</h2>
        <p class="text-grey-darken-1">Enter the details for the new asset.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn
          :loading="saving"
          size="large"
          @click="saveAsset"
          prepend-icon="mdi-content-save"
          color="primary"
        >
          Save Asset
        </v-btn>
      </v-col>
    </v-row>

    <v-card class="mt-4" flat border>
      <v-card-text class="py-6">
        <v-row>
          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Asset Name <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.name"
              label="e.g., Plastic Chairs, First Aid Kit"
              variant="outlined"
              :error-messages="v$.name.$errors.map(e => e.$message)"
              @blur="v$.name.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Category <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.category"
              label="e.g., Furniture, Medical, Equipment"
              variant="outlined"
              :error-messages="v$.category.$errors.map(e => e.$message)"
              @blur="v$.category.$touch"
            ></v-text-field>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Total Quantity <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.total_quantity"
              type="number"
              variant="outlined"
              :error-messages="v$.total_quantity.$errors.map(e => e.$message)"
              @blur="v$.total_quantity.$touch"
              :min="0"
            ></v-text-field>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useVuelidate } from '@vuelidate/core';
import { required, minValue, numeric } from '@vuelidate/validators';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const router = useRouter();

const form = reactive({
  name: '',
  total_quantity: null,
  category: '',
});

const saving = ref(false);

const rules = {
  name: { required },
  category: { required },
  total_quantity: { required, numeric, minValue: minValue(0) },
};

const v$ = useVuelidate(rules, form);

async function saveAsset() {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) {
    $toast.fire({ title: 'Please correct the form errors.', icon: 'error' });
    return;
  }

  saving.value = true;
  try {
    const { data, error } = await useMyFetch('/api/assets', {
      method: 'post', 
      body: form,
    });

    if (error.value) {
      throw new Error(error.value.data?.error || 'Failed to add asset.');
    }

    $toast.fire({ title: 'Asset added successfully!', icon: 'success' });
    router.push('/assets');

  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
  } finally {
    saving.value = false;
  }
}
</script>