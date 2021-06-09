/* global Vue */

var apiURL = 'https://api.github.com/repos/vuejs/vue/commits?per_page=3&sha='

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
    // branches: ['master', 'dev'],
    currentBranch: 'master',
    // commits: null,
    // test: {
    //   b: 1
    // }
  },
  // mixins: [{
  //   created: function () {
  //     console.log('222')
  //   },
  //   watch: {
  //     currentBranch() {
  //       console.log(333)
  //     }
  //   },
  // }],
  computed: {
    commitRecord() {
      return this.currentBranch + "_test"
    }
  },
  created: function () {
    this.fetchData()
  },

  // watch: {
  //   currentBranch: 'fetchData'
  // },

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
      if (navigator.userAgent.indexOf('PhantomJS') > -1) {
        // use mocks in e2e to avoid dependency on network / authentication
        setTimeout(function () {
          self.commits = window.MOCKS[self.currentBranch]
        }, 0)
      } else {
        var xhr = new XMLHttpRequest()
        xhr.open('GET', apiURL + self.currentBranch)
        xhr.onload = function () {
          self.commits = JSON.parse(xhr.responseText)
          console.log(self.commits[0].html_url)
        }
        xhr.send()
      }
    }
  }
})
