<template>
  <v-container class="my-10">
    <v-row justify="space-between mb-10">
      <v-col><h2>Add New Customer</h2></v-col>
      <v-col class="text-right"
        ><v-btn
          rounded
          size="large"
          variant="tonal"
          prepend-icon="mdi-content-save"
          color="primary"
          @click="saveCustomer()"
          >Save Customer</v-btn
        ></v-col
      >
    </v-row>

    <!-- content here -->
    <v-card class="pa-3" rounded="lg">
      <v-card-text>
        <v-autocomplete
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          color="primary"
          v-model:search="searchProductQuery"
          @update:search="searchProducts"
          @update:modelValue="searchForItem"
          label="Search for Products"
          placeholder="Search for product name, serial id, model etc.."
          item-title="name"
          item-value="id"
          v-model="itemId"
          :items="productSearchResult"
          rounded="lg"
        ></v-autocomplete>

        <h3 class="font-weight-regular text-primary mt-4">
          <v-icon icon="mdi-package-variant" class="mr-2" size="30"></v-icon
          >Selected Product
        </h3>
        <v-card variant="outlined" color="primary" class="pa-4 my-4">
          <v-card-text v-if="itemInformation?.id">
            <v-row flex-wrap>
              <v-col cols="12" md="3">
                <p>Brand</p>
                <h2 class="text-black">{{ itemInformation?.brand }}</h2>
              </v-col>
              <v-col cols="12" md="3">
                <p>Item</p>
                <h2 class="text-black">{{ itemInformation?.model }}</h2>
              </v-col>
              <v-col cols="12" md="3">
                <p>Unit</p>
                <h2 class="text-black">{{ itemInformation?.unit }}</h2>
              </v-col>
              <v-col cols="12" md="3">
                <p>Serial No.</p>
                <h2 class="text-black">{{ itemInformation?.serial_id }}</h2>
              </v-col>
              <v-col cols="12" class="text-center">
                <p>COD</p>
                <h2 class="text-black text-primary">
                  {{
                    new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }).format(itemInformation?.cod)
                  }}
                </h2>
              </v-col>
            </v-row>
          </v-card-text>
          <v-card-text v-else class="text-center py-5">
            <v-icon icon="mdi-package-variant" color="grey" size="60"></v-icon>
            <h3 class="mt-5 text-grey">Search for products</h3>
          </v-card-text>
        </v-card>

        <div class="d-flex justify-space-between align-center mt-12"  v-if="itemInformation?.id">
          <h3 class="font-weight-regular text-primary">
            <v-icon icon="mdi-cash-multiple" class="mr-2" size="30"></v-icon
            >Select Monthly Payments
          </h3>
          <div>
            <v-text-field
              v-model="down_payment"
              label="Set DP"
              max-width="250"
              prepend-inner-icon="mdi-currency-php"
              hide-details
            ></v-text-field>
            <v-btn @click="calculateMonthly" variant="tonal" color="primary"
              >Recalculate</v-btn
            >
          </div>
        </div>

        <div
           v-if="itemInformation?.id"
          class="scrollable py-5 d-flex flex-nowrap flex-0-0 overflow-x-auto ga-5"
        >
          <v-card
            style="flex: 0 0 250px"
            class="pa-3 py-6 text-center"
            @click="selectedTerms = 3"
            variant="outlined"
            v-ripple
            :elevation="selectedTerms == 3 ? 5 : 0"
            :color="selectedTerms == 3 ? 'primary' : 'grey'"
          >
            <h3 class="text-primary">3 months</h3>
            <p class="text-grey mt-5 mb-2">Down Payment</p>
            <h2 class="text-black">
              {{
                new Intl.NumberFormat("en-PH", {
                  style: "currency",
                  currency: "PHP",
                }).format(down_payment)
              }}
            </h2>
            <p class="text-grey mt-5 mb-2">Down Payment</p>
            <v-text-field
              :disabled="selectedTerms == 3 ? false : true"
              prepend-inner-icon="mdi-currency-php"
              class="font-weight-bold text-black"
              v-model="three_months_calc"
              type="number"
            ></v-text-field>
          </v-card>
          <v-card
            style="flex: 0 0 250px"
            class="pa-3 py-6 text-center"
            @click="selectedTerms = 6"
            variant="outlined"
            v-ripple
            :elevation="selectedTerms == 6 ? 5 : 0"
            :color="selectedTerms == 6 ? 'primary' : 'grey'"
          >
            <h3 class="text-primary">6 months</h3>
            <p class="text-grey mt-5 mb-2">Down Payment</p>
            <h2 class="text-black">
              {{
                new Intl.NumberFormat("en-PH", {
                  style: "currency",
                  currency: "PHP",
                }).format(down_payment)
              }}
            </h2>
            <p class="text-grey mt-5 mb-2">Down Payment</p>
            <v-text-field
              :disabled="selectedTerms == 6 ? false : true"
              prepend-inner-icon="mdi-currency-php"
              class="font-weight-bold text-black"
              v-model="six_months_calc"
              type="number"
            ></v-text-field>
          </v-card>
          <v-card
            style="flex: 0 0 250px"
            class="pa-3 py-6 text-center"
            @click="selectedTerms = 12"
            variant="outlined"
            v-ripple
            :elevation="selectedTerms == 12 ? 5 : 0"
            :color="selectedTerms == 12 ? 'primary' : 'grey'"
          >
            <h3 class="text-primary">12 months</h3>
            <p class="text-grey mt-5 mb-2">Down Payment</p>
            <h2 class="text-black">
              {{
                new Intl.NumberFormat("en-PH", {
                  style: "currency",
                  currency: "PHP",
                }).format(down_payment)
              }}
            </h2>
            <p class="text-grey mt-5 mb-2">Down Payment</p>
            <v-text-field
              :disabled="selectedTerms == 12 ? false : true"
              prepend-inner-icon="mdi-currency-php"
              class="font-weight-bold text-black"
              v-model="twelve_months_calc"
              type="number"
            ></v-text-field>
          </v-card>
          <v-card
            style="flex: 0 0 250px"
            class="pa-3 py-6 text-center"
            @click="selectedTerms = 18"
            variant="outlined"
            v-ripple
            :elevation="selectedTerms == 18 ? 5 : 0"
            :color="selectedTerms == 18 ? 'primary' : 'grey'"
          >
            <h3 class="text-primary">18 months</h3>
            <p class="text-grey mt-5 mb-2">Down Payment</p>
            <h2 class="text-black">
              {{
                new Intl.NumberFormat("en-PH", {
                  style: "currency",
                  currency: "PHP",
                }).format(down_payment)
              }}
            </h2>
            <p class="text-grey mt-5 mb-2">Down Payment</p>
            <v-text-field
              :disabled="selectedTerms == 18 ? false : true"
              prepend-inner-icon="mdi-currency-php"
              class="font-weight-bold text-black"
              v-model="eighteen_months_calc"
              type="number"
            ></v-text-field>
          </v-card>
          <v-card
            style="flex: 0 0 250px"
            class="pa-3 py-6 text-center"
            @click="selectedTerms = 24"
            variant="outlined"
            v-ripple
            :elevation="selectedTerms == 24 ? 5 : 0"
            :color="selectedTerms == 24 ? 'primary' : 'grey'"
          >
            <h3 class="text-primary">24 months</h3>
            <p class="text-grey mt-5 mb-2">Down Payment</p>
            <h2 class="text-black">
              {{
                new Intl.NumberFormat("en-PH", {
                  style: "currency",
                  currency: "PHP",
                }).format(down_payment)
              }}
            </h2>
            <p class="text-grey mt-5 mb-2">Down Payment</p>
            <v-text-field
              :disabled="selectedTerms == 24 ? false : true"
              prepend-inner-icon="mdi-currency-php"
              class="font-weight-bold text-black"
              v-model="twenty_four_months_calc"
              type="number"
            ></v-text-field>
          </v-card>
        </div>

        <h3 class="font-weight-regular text-primary mt-12 mb-5"  v-if="itemInformation?.id">
          <v-icon icon="mdi-calendar" class="mr-2" size="30"></v-icon>Payment
          Terms
        </h3>

        <v-row  v-if="itemInformation?.id">
          <v-col cols="12" sm="6" md="6">
            <v-date-input label="Starting Date" v-model="starting_date"></v-date-input>
          </v-col>
          <v-col cols="12" sm="6" md="6">
            <v-text-field
              v-model="rebates"
              label="Rebate"
              prepend-icon="mdi-currency-php"
            ></v-text-field>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Personal Data -->
    <div class="header text-center py-13">
      <v-divider class="mb-n7" style="z-index: -1"></v-divider>
      <h3 class="d-inline-block pa-3 bg-white z-index-1">
        Customer's Personal Data
      </h3>
    </div>

    <v-card prepend-icon="mdi-package-variant" title="Personal Data">
      <v-card-item>
        <v-row>
          <v-col cols="12" sm="12" md="9">
            <v-text-field
              v-model="applicantName"
              label="Applicant's Name"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="3">
            <v-select
              v-model="civilStatus"
              label="Civil Status"
              :items="['Single', 'Married', 'Separated', 'Widowed']"
            ></v-select>
          </v-col>
          <v-col cols="12" sm="12">
            <v-text-field
              v-model="spouseName"
              label="Spouse's Name"
            ></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="6" md="3">
            <v-text-field
              v-model="applicantAge"
              label="Applicant's Age"
              type="number"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-text-field
              v-model="spouseAge"
              label="Spouse's Age"
              type="number"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="numberOfDependents"
              label="No. of Dependents"
              type="number"
            ></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="contactNumber"
              label="Contact Number"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <v-text-field v-model="agent" label="Agent"></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field v-model="address" label="Address"></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <v-text-field v-model="city" label="City"></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field v-model="deliverTo" label="Deliver To"></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <v-select
              v-model="residenceType"
              label="Residence Type"
              :items="['Own House', 'Rent House', 'Living w/ parents']"
            ></v-select>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="lengthOfStay"
              label="Length of Stay"
              placeholder="eg. 5 years"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <!-- <v-text-field v-model="collector" label="Collector"></v-text-field> -->
            <v-autocomplete v-model="collector" label="Collector" :items="collectors" item-title="name" item-value="id" @update:search="getCollectors"></v-autocomplete>
          </v-col>
        </v-row>

        <!-- Dependents -->
        <v-row>
          <v-col cols="12">
            <h4>Dependents</h4>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="10" md="8">
            <v-text-field
              v-model="dependent1Name"
              label="Name of Dependent 1"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="2" md="4">
            <v-text-field
              v-model="dependent1Age"
              label="Age"
              type="number"
            ></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="10" md="8">
            <v-text-field
              v-model="dependent2Name"
              label="Name of Dependent 2"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="2" md="4">
            <v-text-field
              v-model="dependent2Age"
              label="Age"
              type="number"
            ></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="10" md="8">
            <v-text-field
              v-model="dependent3Name"
              label="Name of Dependent 3"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="2" md="4">
            <v-text-field
              v-model="dependent3Age"
              label="Age"
              type="number"
            ></v-text-field>
          </v-col>
        </v-row>
      </v-card-item>
    </v-card>

    <!-- References Relative -->
    <div class="header text-center py-13">
      <v-divider class="mb-n7" style="z-index: -1"></v-divider>
      <h3 class="d-inline-block pa-3 bg-white z-index-1">
        References (Relative)
      </h3>
    </div>

    <v-card prepend-icon="mdi-account-multiple" title="References (Relatives)">
      <v-card-item>
        <!-- Reference 1 -->
        <v-row>
          <v-col cols="12">
            <h4>Reference 1</h4>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="relativeReference1Name"
              label="Name"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="relativeReference1Address"
              label="Address"
            ></v-text-field>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="relativeReference1Relationship"
              label="Relationship"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="relativeReference1Telephone"
              label="Telephone"
            ></v-text-field>
          </v-col>
        </v-row>

        <!-- Reference 2 -->
        <v-row>
          <v-col cols="12">
            <h4>Reference 2</h4>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="relativeReference2Name"
              label="Name"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="relativeReference2Address"
              label="Address"
            ></v-text-field>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="relativeReference2Relationship"
              label="Relationship"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="relativeReference2Telephone"
              label="Telephone"
            ></v-text-field>
          </v-col>
        </v-row>
      </v-card-item>
    </v-card>
    <!-- References Character -->
    <div class="header text-center py-13">
      <v-divider class="mb-n7" style="z-index: -1"></v-divider>
      <h3 class="d-inline-block pa-3 bg-white z-index-1">
        References (Character)
      </h3>
    </div>

    <v-card prepend-icon="mdi-account-multiple" title="References (Character)">
      <v-card-item>
        <!-- Reference 1 -->
        <v-row>
          <v-col cols="12">
            <h4>Reference 1</h4>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="characterReference1Name"
              label="Name"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="characterReference1Address"
              label="Address"
            ></v-text-field>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="characterReference1Relationship"
              label="Relationship"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="characterReference1Telephone"
              label="Telephone"
            ></v-text-field>
          </v-col>
        </v-row>

        <!-- Reference 2 -->
        <v-row>
          <v-col cols="12">
            <h4>Reference 2</h4>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="characterReference2Name"
              label="Name"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="characterReference2Address"
              label="Address"
            ></v-text-field>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="characterReference2Relationship"
              label="Relationship"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="characterReference2Telephone"
              label="Telephone"
            ></v-text-field>
          </v-col>
        </v-row>
      </v-card-item>
    </v-card>

    <!-- Economic Information -->
    <div class="header text-center py-13">
      <v-divider class="mb-n7" style="z-index: -1"></v-divider>
      <h3 class="d-inline-block pa-3 bg-white z-index-1">
        Economic Information
      </h3>
    </div>

    <v-card prepend-icon="mdi-cash-multiple" title="Economic Information">
      <v-card-item>
        <!-- Current Employment -->
        <v-row>
          <v-col cols="12">
            <h4>Current Employment</h4>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="currentEmployer"
              label="Employer"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="currentEmployerAddress"
              label="Employer's Address"
            ></v-text-field>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              v-model="currentPosition"
              label="Position"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              v-model="currentYearsThere"
              label="Years There"
              type="number"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="12" md="4">
            <v-text-field
              v-model="currentPesosPerMonth"
              label="Pesos per Month"
              prefix="₱"
              type="number"
            ></v-text-field>
          </v-col>
        </v-row>

        <!-- Previous Employment -->
        <v-row>
          <v-col cols="12">
            <h4>Previous Employment</h4>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" sm="12" md="6">
            <v-text-field
              v-model="previousEmployer"
              label="Previous Employer"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-text-field
              v-model="previousYearsThere"
              label="Years There"
              type="number"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-text-field
              v-model="previousPesosPerMonth"
              label="Pesos per Month"
              prefix="₱"
              type="number"
            ></v-text-field>
          </v-col>
        </v-row>
      </v-card-item>
    </v-card>
  </v-container>
</template>

<script setup>
import { VDateInput } from "vuetify/labs/VDateInput";

// Date selection
const menu = ref(false);
const date = ref(null);

const productSearchResult = ref([
  // {
  //   name: 'Samsung Galaxy S21 Ultra Black 128GB [SN: 1234567890]',
  //   id: 155,
  // },
  // {
  //   name: 'Google Pixel 6 Pro White 256GB [SN: 0987654321]',
  //   id: 156,
  // },
  // {
  //   name: 'OnePlus 9 Pro Green 256GB [SN: 1122334455]',
  //   id: 157,
  // },
  // {
  //   name: 'Xiaomi Mi 11 Ultra Silver 512GB [SN: 6677889900]',
  //   id: 158,
  // },
  // {
  //   name: 'Sony Xperia 5 III Blue 128GB [SN: 3344556677]',
  //   id: 159,
  // }
]);

const collectors = ref([]);
const collectorsSearch = ref();

async function getCollectors() {
  const { data, error } = await useMyFetch("/api/employees", {
    method: "get",
    query: {
      search: collectorsSearch.value,
    },
  });
  if (error.value) return;
  collectors.value = data.value.data;
}

const itemInformation = ref({});

async function searchForItem(data) {
  const { data: res, error } = await useMyFetch("/api/products/" + data);

  if (error.value) return;
  if (!res.value.product) return;
  itemInformation.value = res.value?.product;

  down_payment.value = Number(res.value?.product?.cod) * 0.2;
  total_price.value = Number(res.value?.product.cod);
  itemId.value = data;
  calculateMonthly();

  console.log(itemInformation.value);
}

const searchProductQuery = ref("");
async function searchProducts(searchData) {
  // console.log(searchData, searchProductQuery.value)
  const { data, error } = await useMyFetch("/api/search/products", {
    method: "get",
    query: {
      search: searchProductQuery.value,
    },
  });

  if (error.value) return;

  productSearchResult.value = data.value.data;
}

const router = useRouter();
async function saveCustomer() {
  console.log(itemId);
  // logAllVModels();
  const customerData = {

        starting_date: starting_date.value,
        rebates: rebates.value,
        itemId: itemId.value,
        down_payment: parseFloat(down_payment.value) || 0,
        selectedTerms: parseInt(selectedTerms.value) || 3,
        threeMonthsCalc: parseFloat(three_months_calc.value) || 0,
        sixMonthsCalc: parseFloat(six_months_calc.value) || 0,
        twelveMonthsCalc: parseFloat(twelve_months_calc.value) || 0,
        eighteenMonthsCalc: parseFloat(eighteen_months_calc.value) || 0,
        twentyFourMonthsCalc: parseFloat(twenty_four_months_calc.value) || 0,
        applicantName: applicantName.value,
        civilStatus: civilStatus.value,
        spouseName: spouseName.value,
        applicantAge: parseInt(applicantAge.value) || null,
        spouseAge: parseInt(spouseAge.value) || null,
        numberOfDependents: parseInt(numberOfDependents.value) || null,
        contactNumber: contactNumber.value,
        agent: agent.value,
        address: address.value,
        city: city.value,
        deliverTo: deliverTo.value,
        residenceType: residenceType.value,
        lengthOfStay: lengthOfStay.value,
        collector: collector.value,
        dependent1Name: dependent1Name.value,
        dependent1Age: parseInt(dependent1Age.value) || null,
        dependent2Name: dependent2Name.value,
        dependent2Age: parseInt(dependent2Age.value) || null,
        dependent3Name: dependent3Name.value,
        dependent3Age: parseInt(dependent3Age.value) || null,
        relativeReference1Name: relativeReference1Name.value,
        relativeReference1Address: relativeReference1Address.value,
        relativeReference1Relationship: relativeReference1Relationship.value,
        relativeReference1Telephone: relativeReference1Telephone.value,
        relativeReference2Name: relativeReference2Name.value,
        relativeReference2Address: relativeReference2Address.value,
        relativeReference2Relationship: relativeReference2Relationship.value,
        relativeReference2Telephone: relativeReference2Telephone.value,
        characterReference1Name: characterReference1Name.value,
        characterReference1Address: characterReference1Address.value,
        characterReference1Relationship: characterReference1Relationship.value,
        characterReference1Telephone: characterReference1Telephone.value,
        characterReference2Name: characterReference2Name.value,
        characterReference2Address: characterReference2Address.value,
        characterReference2Relationship: characterReference2Relationship.value,
        characterReference2Telephone: characterReference2Telephone.value,
        currentEmployer: currentEmployer.value,
        currentEmployerAddress: currentEmployerAddress.value,
        currentPosition: currentPosition.value,
        currentYearsThere: parseInt(currentYearsThere.value) || null,
        currentPesosPerMonth: parseFloat(currentPesosPerMonth.value) || null,
        previousEmployer: previousEmployer.value,
        previousYearsThere: parseInt(previousYearsThere.value) || null,
        previousPesosPerMonth: parseFloat(previousPesosPerMonth.value) || null,
      };

      console.log("Data to send to backend:", customerData);

      const {data, error, status} = await useMyFetch('/api/customers', {
      method: 'post', 
      body: customerData
    })

    console.log(data);

    if (error.value) {
      return;
    }

    router.push('/customers')
    $toast.fire({
      title: 'Customer added!',
      icon: 'success'
    })
}

async function calculateMonthly() {
  three_months_calc.value = parseFloat(
    (((total_price.value - down_payment.value) / 0.81 + 210) / 3).toFixed(2)
  );
  six_months_calc.value = parseFloat(
    (((total_price.value - down_payment.value) / 0.72 + 340) / 6).toFixed(2)
  );
  twelve_months_calc.value = parseFloat(
    (((total_price.value - down_payment.value) / 0.61 + 470) / 12).toFixed(2)
  );
  eighteen_months_calc.value = parseFloat(
    (((total_price.value - down_payment.value) / 0.51 + 850) / 18).toFixed(2)
  );
  twenty_four_months_calc.value = parseFloat(
    (((total_price.value - down_payment.value) / 0.42 + 650) / 24).toFixed(2)
  );
}
const total_price = ref(0);

const itemId = ref(null);
const down_payment = ref(0);
const selectedTerms = ref(3);

const starting_date = ref(null);
const rebates = ref(0);

const three_months_calc = ref(0);
const six_months_calc = ref(0);
const twelve_months_calc = ref(0);
const eighteen_months_calc = ref(0);
const twenty_four_months_calc = ref(0);

const applicantName = ref(null);
const civilStatus = ref(null);
const spouseName = ref(null);
const applicantAge = ref(null);
const spouseAge = ref(null);
const numberOfDependents = ref(null);
const contactNumber = ref(null);
const agent = ref(null);
const address = ref(null);
const city = ref(null);
const deliverTo = ref(null);
const residenceType = ref(null);
const lengthOfStay = ref(null);
const collector = ref(null);
const dependent1Name = ref(null);
const dependent1Age = ref(null);
const dependent2Name = ref(null);
const dependent2Age = ref(null);
const dependent3Name = ref(null);
const dependent3Age = ref(null);
const relativeReference1Name = ref(null);
const relativeReference1Address = ref(null);
const relativeReference1Relationship = ref(null);
const relativeReference1Telephone = ref(null);
const relativeReference2Name = ref(null);
const relativeReference2Address = ref(null);
const relativeReference2Relationship = ref(null);
const relativeReference2Telephone = ref(null);
const characterReference1Name = ref(null);
const characterReference1Address = ref(null);
const characterReference1Relationship = ref(null);
const characterReference1Telephone = ref(null);
const characterReference2Name = ref(null);
const characterReference2Address = ref(null);
const characterReference2Relationship = ref(null);
const characterReference2Telephone = ref(null);
const currentEmployer = ref(null);
const currentEmployerAddress = ref(null);
const currentPosition = ref(null);
const currentYearsThere = ref(null);
const currentPesosPerMonth = ref(null);
const previousEmployer = ref(null);
const previousYearsThere = ref(null);
const previousPesosPerMonth = ref(null);

const logAllVModels = () => {
  console.log("--- Product Search ---");
  console.log("Item ID:", itemId.value);
  console.log("Item Information:", itemInformation.value);

  console.log("\n--- Monthly Payments ---");
  console.log("Down Payment:", down_payment.value);
  console.log("Selected Terms:", selectedTerms.value);
  console.log("3 Months Calculation:", three_months_calc.value);
  console.log("6 Months Calculation:", six_months_calc.value);
  console.log("12 Months Calculation:", twelve_months_calc.value);
  console.log("18 Months Calculation:", eighteen_months_calc.value);
  console.log("24 Months Calculation:", twenty_four_months_calc.value);

  console.log("\n--- Customer's Personal Data ---");
  console.log("Applicant Name:", applicantName.value);
  console.log("Civil Status:", civilStatus.value);
  console.log("Spouse Name:", spouseName.value);
  console.log("Applicant Age:", applicantAge.value);
  console.log("Spouse Age:", spouseAge.value);
  console.log("Number of Dependents:", numberOfDependents.value);
  console.log("Contact Number:", contactNumber.value);
  console.log("Agent:", agent.value);
  console.log("Address:", address.value);
  console.log("City:", city.value);
  console.log("Deliver To:", deliverTo.value);
  console.log("Residence Type:", residenceType.value);
  console.log("Length of Stay:", lengthOfStay.value);
  console.log("Collector:", collector.value);

  console.log("\n--- Dependents ---");
  console.log("Dependent 1 Name:", dependent1Name.value);
  console.log("Dependent 1 Age:", dependent1Age.value);
  console.log("Dependent 2 Name:", dependent2Name.value);
  console.log("Dependent 2 Age:", dependent2Age.value);
  console.log("Dependent 3 Name:", dependent3Name.value);
  console.log("Dependent 3 Age:", dependent3Age.value);

  console.log("\n--- References (Relative) ---");
  console.log("Relative Reference 1 Name:", relativeReference1Name.value);
  console.log("Relative Reference 1 Address:", relativeReference1Address.value);
  console.log(
    "Relative Reference 1 Relationship:",
    relativeReference1Relationship.value
  );
  console.log(
    "Relative Reference 1 Telephone:",
    relativeReference1Telephone.value
  );
  console.log("Relative Reference 2 Name:", relativeReference2Name.value);
  console.log("Relative Reference 2 Address:", relativeReference2Address.value);
  console.log(
    "Relative Reference 2 Relationship:",
    relativeReference2Relationship.value
  );
  console.log(
    "Relative Reference 2 Telephone:",
    relativeReference2Telephone.value
  );

  console.log("\n--- References (Character) ---");
  console.log("Character Reference 1 Name:", characterReference1Name.value);
  console.log(
    "Character Reference 1 Address:",
    characterReference1Address.value
  );
  console.log(
    "Character Reference 1 Relationship:",
    characterReference1Relationship.value
  );
  console.log(
    "Character Reference 1 Telephone:",
    characterReference1Telephone.value
  );
  console.log("Character Reference 2 Name:", characterReference2Name.value);
  console.log(
    "Character Reference 2 Address:",
    characterReference2Address.value
  );
  console.log(
    "Character Reference 2 Relationship:",
    characterReference2Relationship.value
  );
  console.log(
    "Character Reference 2 Telephone:",
    characterReference2Telephone.value
  );

  console.log("\n--- Economic Information ---");
  console.log("Current Employer:", currentEmployer.value);
  console.log("Current Employer Address:", currentEmployerAddress.value);
  console.log("Current Position:", currentPosition.value);
  console.log("Current Years There:", currentYearsThere.value);
  console.log("Current Pesos Per Month:", currentPesosPerMonth.value);
  console.log("Previous Employer:", previousEmployer.value);
  console.log("Previous Years There:", previousYearsThere.value);
  console.log("Previous Pesos Per Month:", previousPesosPerMonth.value);
};
</script>
