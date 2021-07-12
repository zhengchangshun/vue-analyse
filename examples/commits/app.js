/* global Vue */

var apiURL = 'https://api.github.com/repos/vuejs/vue/commits?per_page=3&sha='

const AAA = {
  install(Vue, options) {
    console.log(options.test)
  }
}


// 注册2次插件AAA，因为2次注册是时AAA是同一个对象，Vue.use会认为已经注册，所以不会重复注册
Vue.use(AAA, { test: 111 })
Vue.use(AAA, { test: 222 })

Vue.component('COMA', {
  data() {
    return {
      a: 11,
    }
  },
})


// Vue.mixin({
//   data(){
//     return {
//       branches: ['feature'],
//       test: {
//         a: 1
//       }
//     }
//   },
//   created: function () {
//     console.log('1111')
//   }
// })

var vm = new Vue({

  el: '#demo',
  props: {
    // propsA: String,
  },
  data: {
    branches: ['master', 'dev'],
    currentBranch: 'master',
    commits: null,
    test: {
      b: 1
    }
  },
  computed: {
    commitRecord() {
      return this.currentBranch + "_test"
    },
    AAAAAAAAAA() {
      return this.branchs
    }
  },
  created: function () {
    this.fetchData()
  },
  mounted() {
    this.$nextTick(() => {
      console.log('<<<<<<<<<<<<<<<<<<<<')
    })
    this.$nextTick(() => {
      console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>')
    })
  },

  watch: {
    currentBranch: 'fetchData',
    branches(newVal, oldValue) {
      console.log(111111)
    },
    commits: {
      deep: true,
      handler() {
        console.log(2222222)
      }
    }
  },
  beforeUpdate() {
    console.log('beforeUpdate')
  },
  filters: {
    truncate: function (v) {
      var newline = v.indexOf('\n')
      return newline > 0 ? v.slice(0, newline) : v
    },
    formatDate: function (v) {
      return v.replace(/T|Z/g, ' ')
    }
  },

  methods: {
    fetchData: function () {
      var self = this
      setTimeout(function () {
        self.commits = window.MOCKS[self.currentBranch]
      }, 0)
    },
    clickHandel() {
      this.branches.push('feature')
      this.commits.push({
        "sha": "df8f179cfc3b98d6e0f48502cc5071b993d9cdb5",
        "node_id": "MDY6Q29tbWl0MTE3MzAzNDI6ZGY4ZjE3OWNmYzNiOThkNmUwZjQ4NTAyY2M1MDcxYjk5M2Q5Y2RiNQ==",
        "commit": {
          "author": { "name": "Evan You", "email": "yyx990803@gmail.com", "date": "2017-10-13T00:41:36Z" },
          "committer": { "name": "Evan You", "email": "yyx990803@gmail.com", "date": "2017-10-13T00:41:36Z" },
          "message": "test: make hydration spec more stable for Edge",
          "tree": { "sha": "b399dba6180378d6a04715a5624599b49b3e6454", "url": "https://api.github.com/repos/vuejs/vue/git/trees/b399dba6180378d6a04715a5624599b49b3e6454" },
          "url": "https://api.github.com/repos/vuejs/vue/git/commits/df8f179cfc3b98d6e0f48502cc5071b993d9cdb5",
          "comment_count": 0,
          "verification": { "verified": false, "reason": "unsigned", "signature": null, "payload": null }
        },
        "url": "https://api.github.com/repos/vuejs/vue/commits/df8f179cfc3b98d6e0f48502cc5071b993d9cdb5",
        "html_url": "https://github.com/vuejs/vue/commit/df8f179cfc3b98d6e0f48502cc5071b993d9cdb5",
        "comments_url": "https://api.github.com/repos/vuejs/vue/commits/df8f179cfc3b98d6e0f48502cc5071b993d9cdb5/comments",
        "author": {
          "login": "yyx990803",
          "id": 499550,
          "node_id": "MDQ6VXNlcjQ5OTU1MA==",
          "avatar_url": "https://avatars1.githubusercontent.com/u/499550?v=4",
          "gravatar_id": "",
          "url": "https://api.github.com/users/yyx990803",
          "html_url": "https://github.com/yyx990803",
          "followers_url": "https://api.github.com/users/yyx990803/followers",
          "following_url": "https://api.github.com/users/yyx990803/following{/other_user}",
          "gists_url": "https://api.github.com/users/yyx990803/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/yyx990803/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/yyx990803/subscriptions",
          "organizations_url": "https://api.github.com/users/yyx990803/orgs",
          "repos_url": "https://api.github.com/users/yyx990803/repos",
          "events_url": "https://api.github.com/users/yyx990803/events{/privacy}",
          "received_events_url": "https://api.github.com/users/yyx990803/received_events",
          "type": "User",
          "site_admin": false
        },
        "committer": {
          "login": "yyx990803",
          "id": 499550,
          "node_id": "MDQ6VXNlcjQ5OTU1MA==",
          "avatar_url": "https://avatars1.githubusercontent.com/u/499550?v=4",
          "gravatar_id": "",
          "url": "https://api.github.com/users/yyx990803",
          "html_url": "https://github.com/yyx990803",
          "followers_url": "https://api.github.com/users/yyx990803/followers",
          "following_url": "https://api.github.com/users/yyx990803/following{/other_user}",
          "gists_url": "https://api.github.com/users/yyx990803/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/yyx990803/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/yyx990803/subscriptions",
          "organizations_url": "https://api.github.com/users/yyx990803/orgs",
          "repos_url": "https://api.github.com/users/yyx990803/repos",
          "events_url": "https://api.github.com/users/yyx990803/events{/privacy}",
          "received_events_url": "https://api.github.com/users/yyx990803/received_events",
          "type": "User",
          "site_admin": false
        },
        "parents": [{ "sha": "a85f95c422e0bde6ce4068f5e44e761d4e00ca08", "url": "https://api.github.com/repos/vuejs/vue/commits/a85f95c422e0bde6ce4068f5e44e761d4e00ca08", "html_url": "https://github.com/vuejs/vue/commit/a85f95c422e0bde6ce4068f5e44e761d4e00ca08" }]
      })
    }
  }
})
