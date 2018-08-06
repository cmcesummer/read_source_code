import React, {Component} from 'react';
import StoreContext from './StoreContext';
// import PropTypes from 'prop-types';

export default class Provider extends Component {
    // static propTypes = {
    //     store: PropTypes.shape({
    //         subscribe: PropTypes.func.isRequired,
    //         dispatch: PropTypes.func.isRequired,
    //         getState: PropTypes.func.isRequired
    //     })
    // }
    state = {
        state: this.props.store.getState(),
        dispatch: this.props.store.dispatch,
    }
    componentDidMount() {
        // const { store } = this.props;
        // this.unsub = store.subscribe(() => {
        //     this.setState({
        //         state: this.props.store.getState()
        //     })
        // })
    }
    render() {
        console.log(this.props.store.getState());
        const { store } = this.props;
        return (
            <StoreContext.Provider value={store}>
                {this.props.children}
            </StoreContext.Provider>
        )
    }
}
