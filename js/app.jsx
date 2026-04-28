/**
 * Copyright 2016-2021 Sourcepole AG
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {createRoot} from 'react-dom/client';
import StandardApp from 'qwc2/components/StandardApp';
import AboutPage from './components/pages/AboutPage';
import CalculationsPage from './components/pages/CalculationsPage';
import LoginPage from './components/pages/LoginPage';
import RegistrationPage from './components/pages/RegistrationPage';
import appConfig from './appConfig';
import './routes.css';
import '../icons/build/qwc2-icons.css';

const routes = {
    '/about': AboutPage,
    '/calculations': CalculationsPage,
    '/log-in': LoginPage,
    '/registration': RegistrationPage
};

function normalizePath(pathname) {
    const cleanPath = pathname.replace(/\/+$/, '');
    return cleanPath || '/maps';
}

function AppRouter() {
    const path = normalizePath(window.location.pathname);
    if (path === '/maps') {
        return <StandardApp appConfig={appConfig}/>;
    }
    const RouteComponent = routes[path] || AboutPage;
    return <RouteComponent/>;
}

const container = document.getElementById('container');
const root = createRoot(container);
root.render(<AppRouter/>);
