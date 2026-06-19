<template>
  <div class="about">
    <h1>This is an about page</h1>

    <p v-highlight>我高亮啦-😄</p>
    <p v-permission="['edit', 'show']">我是被隐藏的</p>
  </div>
</template>

<script setup lang="ts">
// const vHighlight = {
//   mounted: (el: HTMLElement) => (el.style.backgroundColor = 'yellow'),
// }
</script>
<style>
@media (min-width: 1024px) {
  .about {
    min-height: 100vh;
    /* display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center; */
  }
}
</style>
