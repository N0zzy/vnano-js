// @vnano-hmr
import { Component, h } from 'vnano';

export default class App extends Component {
    render() {
        return h('div', null, 'Hello from module variant · ' + new Date().toLocaleTimeString());
    }
}