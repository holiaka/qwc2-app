import React from 'react';
import PageLayout from '../layout/PageLayout';

export default function RegistrationPage() {
    return (
        <PageLayout title="Registration" kicker="Account">
            <p>
                Create access for project participants and reviewers.
            </p>
            <form className="qwc-route-form">
                <label>
                    Full name
                    <input type="text" name="name" placeholder="Full name"/>
                </label>
                <label>
                    Email
                    <input type="email" name="email" placeholder="name@example.com"/>
                </label>
                <label>
                    Organization
                    <input type="text" name="organization" placeholder="Organization"/>
                </label>
                <button type="button">Submit registration</button>
            </form>
        </PageLayout>
    );
}
