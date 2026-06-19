<script setup lang="ts">
defineProps<{
  msg: string
}>()

function indentify<T>(arg: T): T {
  return arg
}
const a = indentify(['1'])

function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}
function swap<A, B>(ary: [A, B]): [B, A] {
  return [ary[1], ary[0]]
}
function wrapInArray<T>(x: T): T[] {
  return [x]
}
function getUserInfo({ name, age }: { name: string; age: number }) {
  return `${name}${age}`
}

type Message = { text: string } | { code: number }
function isText(msg: Message): msg is { text: string } {
  return 'text' in msg
}
</script>

<template>
  <div class="greetings">
    <h1 class="green">{{ msg }}</h1>
    <h3>
      You’ve successfully created a project with
      <a href="https://vite.dev/" target="_blank" rel="noopener">Vite</a> +
      <a href="https://vuejs.org/" target="_blank" rel="noopener">Vue 3</a>. What's next?
    </h3>
  </div>
</template>

<style scoped>
h1 {
  font-weight: 500;
  font-size: 2.6rem;
}

h3 {
  font-size: 1.2rem;
}

.greetings h1,
.greetings h3 {
  text-align: center;
}

@media (min-width: 1024px) {
  .greetings h1,
  .greetings h3 {
    text-align: left;
  }
}
</style>
