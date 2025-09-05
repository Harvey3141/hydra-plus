<script setup>
import { computed } from "vue";
import { CURRENT_VERSION } from "@/constants";
import { getSafeLocalStorage } from "@/utils";
import BaseModal from "./BaseModal";

const showLatestUpdates = computed(
  () => getSafeLocalStorage("welcomeModalLastUpdate") < CURRENT_VERSION,
);
</script>

<template>
  <BaseModal modal-name="WelcomeModal">
    <div v-if="showLatestUpdates">
      <h1 class="mb-5">welcome to version 0.9.2!</h1>

      <h2 class="mb-3">~ Introducing Scenes!</h2>

      <p>
        You can now save your scenes and switch between them. This will make it
        easier to manage your projects.
      </p>
      <p>
        You can also <strong>collapse blocks</strong> by clicking on the
        <i>"arrow"</i>
        icon on top of your source blocks.
      </p>
      <p>
        I tried to fix some bugs I was aware of, please let me know if you find
        any issues. Other features are on the way, keep an eye out for more
        updates! ~
      </p>
      <hr />
    </div>

    <div v-else>
      <h1>welcome!</h1>
      <p>
        <strong>hydra+</strong> is a graphical user interface for
        <a href="https://hydra.ojack.xyz/" target="_blank">hydra</a>, a
        javascript library for livecoding visuals.
      </p>
      <p>
        Please refer to the
        <a href="https://hydra.ojack.xyz/api/" target="_blank">hydra api</a> for
        information on how to use the synthatizer.
      </p>
    </div>

    <p>
      Thank you for using hydra+, your feedback, shared via
      <a href="https://github.com/dahegyi/hydra-plus/issues" target="_blank">
        Github
      </a>
      is highly appreciated. I'll try to answer any questions you might have.
    </p>

    <br />

    <h2>❤️‍🔥 happy hacking!</h2>
  </BaseModal>
</template>

<style lang="scss" scoped>
h1 {
  margin: 1.2rem auto 1.4rem;
  font-size: 1.7rem;
  font-weight: 700;
}

h2 {
  font-size: 1.2rem;
  font-weight: 600;
}

p {
  margin: 0.4rem 0;
}

ul {
  padding-left: 1.2rem;
  margin: 0.4rem 0;

  li {
    margin: 0.2rem 0;
    list-style-type: disc;
  }
}

hr {
  border: 0;
  border-top: 1px solid #888;
  margin: 1.2rem 0 1rem;
}
</style>
