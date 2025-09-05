<script setup>
import { computed } from "vue";
import { useModalStore } from "@/stores/modal";
import { getModalComponent } from "@/services/modalRegistry";

const props = defineProps({
  modalName: {
    type: String,
    required: true,
  },
});

const modalStore = useModalStore();

const modalComponent = computed(() => {
  return getModalComponent(props.modalName);
});

const modalData = computed(() => {
  return modalStore.getModalData(props.modalName);
});

const handleClose = () => {
  modalStore.closeModal(props.modalName);
};
</script>

<template>
  <component
    :is="modalComponent"
    v-if="modalComponent"
    v-bind="modalData"
    @close="handleClose"
  />
</template>
