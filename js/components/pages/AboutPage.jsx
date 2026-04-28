import React from 'react';
import PageLayout from '../layout/PageLayout';

export default function AboutPage() {
    return (
        <PageLayout title="About" kicker="Project">
            <p>
                Chornobyl Exclusion Zone mapping tools, landscape layers, and operational geodata
                in one workspace.
            </p>
            <div className="qwc-route-panel">
                <h2>What this page is for</h2>
                <p>
                    Use this page to describe the project, data sources, partners, update policy,
                    and the purpose of the mapping platform.
                </p>
            </div>
        </PageLayout>
    );
}
