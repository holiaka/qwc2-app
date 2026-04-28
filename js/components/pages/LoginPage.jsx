import React from 'react';
import PageLayout from '../layout/PageLayout';

export default function LoginPage() {
    return (
        <PageLayout title="Log in" kicker="Access">
            <p>
                Use this page for project access and account entry.
            </p>
            <form className="qwc-route-form">
                <label>
                    Email
                    <input type="email" name="email" placeholder="name@example.com"/>
                </label>
                <label>
                    Password
                    <input type="password" name="password" placeholder="Password"/>
                </label>
                <button type="button">Log in</button>
            </form>
        </PageLayout>
    );
}
