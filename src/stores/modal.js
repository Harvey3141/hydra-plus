import { defineStore } from "pinia";
import { ref, computed } from "vue";

export const useModalStore = defineStore("modal", () => {
  const modals = ref(new Map());
  const modalData = ref(new Map());

  const isAnyModalOpen = computed(() => {
    return Array.from(modals.value.values()).some((isOpen) => isOpen);
  });

  const getModalState = (modalName) => {
    return modals.value.get(modalName) || false;
  };

  const getModalData = (modalName) => {
    return modalData.value.get(modalName) || {};
  };

  const openModal = (modalName, data = null) => {
    modals.value.set(modalName, true);

    if (data) {
      modalData.value.set(modalName, { ...getModalData(modalName), ...data });
    }
  };

  const closeModal = (modalName) => {
    modals.value.set(modalName, false);

    const currentData = getModalData(modalName);
    if (currentData && Object.keys(currentData).length > 0) {
      const resetData = Object.keys(currentData).reduce((acc, key) => {
        acc[key] = null;
        return acc;
      }, {});
      modalData.value.set(modalName, resetData);
    }
  };

  const closeAllModals = () => {
    modals.value.clear();
    modalData.value.clear();
  };

  const modalStates = computed(() => {
    return {
      welcome: getModalState("welcome"),
      addBlock: getModalState("addBlock"),
      three: getModalState("three"),
      settings: getModalState("settings"),
      renameScene: getModalState("renameScene"),
    };
  });

  const modalDataObj = computed(() => {
    return {
      renameScene: getModalData("renameScene"),
      addBlock: getModalData("addBlock"),
    };
  });

  return {
    // State
    modals,
    modalData,
    isAnyModalOpen,
    modalStates,
    modalDataObj,

    // Actions
    openModal,
    closeModal,
    closeAllModals,
    getModalState,
    getModalData,
  };
});
