- shared 文件夹下是一些公共方法

## reactivity

调试： `yarn dev reactivity`

- reactivity 是数据相应的核心方法，与框架无关

  - Proxy
  - Reflect
  - ! ts 非空断言

- 查看单例顺序:
  1. reactive
  2. ref
  3. effect
  4. computed
  5. readonly

### reactive 文件中

#### 变量`targetMap`的形式：

1. 在 effect.ts 中 set ref.ts 文件中的 v: Ref  
   这种情况下 `key = ""`

```js
/**
 *  数据格式类似：
 *  targetMap = { Ref: { key: [ effect ] } }
 *  可以理解为： 一个 Ref 就是一个 ref()实例
 */
targetMap.set(target as Ref, new Map())
// 第二个参数 map 中内容 depsMap.set(key!, new Set())
```

2. 在 reactive.ts 文件中 `createReactiveObject` 的时候

```js
/**
 *  数据格式类似：
 *  target = { key: value }
 *  targetMap = { target: { key: [ effect ] } }
 */
targetMap.set(target, new Map())
```

1. reactive 函数

```js
const a = 1
const obj = reactive({
  a
})
```

`reactive(target)`函数干了一件事： 把 target 加入 targetMap, 并对 target 进行 Proxy

2. effect 函数

```js
effect(() => {
  dummy1 = obj.a
})
```

执行参数函数()=>{}, 在执行的过程中触发 target 的 getter, 进而触发 `track`, 为 target 的每个 key 都绑定 effect;

### effect 文件中

1. 关于 track 函数调用：

   - ref get value 的时候一次 track(Ref, 'get', '')
   - baseHandlers 中， Proxy 的 getter 中一次 track(target, 'get', key)

2. run 函数内部 `(activeReactiveEffectStack.indexOf(effect) === -1) {}` 是为了防止内部隐士循环递归调用：例如：

```js
const counter = reactive({ num: 0 })
let times = 0
effect(() => {
  counter.num++
  times++
  console.log(`run times: ${times}`)
})
```

#### Proxy

proxy 不是递归代理， 而是当 get 的时候代理下一级：  
`baseHandlers` 中的 `createGetter`
