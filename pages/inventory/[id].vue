<template>
  <v-container class="my-10">
    <v-row justify="space-between mb-10">
      <v-col><h2>{{brand }} {{ model }} {{ unit }} [{{ serial_id }}]</h2></v-col>
      <v-col class="text-right"
        >
        <v-btn
          rounded
          size="large"
          variant="tonal"
          @click="deleteProduct"
          prepend-icon="mdi-delete"
          color="red"
          >Delete</v-btn
        >
        <v-btn
          rounded
          size="large"
          variant="tonal"
          @click="saveProduct"
          prepend-icon="mdi-package-variant"
          color="blue"
          >Save Changes</v-btn
        >
        </v-col
      >
    </v-row>

    <v-card prepend-icon="mdi-package-variant" title="Product Information">
      <v-card-item>
        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field v-model="serial_id" label="Serial ID"></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <v-text-field v-model="brand" label="Brand"></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field v-model="model" label="Model"></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <v-text-field v-model="unit" label="Unit"></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="12">
            <v-textarea
              v-model="comment"
              label="Comment / Note"
              rows="3"
              auto-grow
            ></v-textarea>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="cod"
              label="COD (Price)"
              prefix="₱"
              type="number"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6" v-if="customer_id">
            <v-btn :to="`/customers/${customer_id}`" size="large" color="primary" variant="tonal"> <v-icon icon="mdi-account" class="mr-2"></v-icon> Purchased by: {{ customer_name }}</v-btn>
          </v-col>
        </v-row>
      </v-card-item>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref } from "vue";
import { useMyFetch } from "../composables/useMyFetch";
import { useRouter } from "vue-router";
import { useNuxtApp } from "#app";

const { $swal, $toast } = useNuxtApp();

const router = useRouter();
const serial_id = ref("");
const brand = ref("");
const model = ref("");
const unit = ref("");
const comment = ref("");
const cod = ref(0);
const customer_name = ref('');
const customer_id = ref(null);

onMounted(async () => {
  const { data } = await useMyFetch(`/api/products/${useRoute().params.id}`);

  // console.log(data);
  if (!data.value?.product) return;

  serial_id.value = data.value?.product?.serial_id;
  brand.value = data.value?.product?.brand;
  model.value = data.value?.product?.model;
  unit.value = data.value?.product?.unit;
  comment.value = data.value?.product?.comment;
  cod.value = data.value?.product?.cod;
  customer_name.value = data.value?.product?.customer_name || 'None'
  customer_id.value = data.value?.product?.customer_id || null
})


const saveProduct = async () => {
  const data = {
    serial_id: serial_id.value,
    brand: brand.value,
    model: model.value,
    unit: unit.value,
    comment: comment.value,
    cod: cod.value,
  };

  try {
    const { postData, error } = await useMyFetch(
      `/api/products/${useRoute().params.id}`,
      {
        method: "put",
        body: data,
      }
    );

    if (error.value) return;

    router.replace("/inventory");
  } catch (error) {
    console.error(error);
    $toast.fire({
      title: "Something went wrong",
      icon: "error",
    });
  }
};

const deleteProduct = async () => {


  const {isConfirmed} = await new $swal({
        title: `Delete ${brand.value} ${model.value} [${serial_id.value}]?`,
        text: 'This can not be reversed!',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel',
    })

  if (!isConfirmed) return;

  try {
    const { postData, error } = await useMyFetch(
      `/api/products/${useRoute().params.id}`,
      {
        method: "delete",
      }
    );

    if (error.value) return;

    router.replace("/inventory");
  } catch (error) {
    console.error(error);
    $toast.fire({
      title: "Something went wrong",
      icon: "error",
    });
  }
};
</script>

