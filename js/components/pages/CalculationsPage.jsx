import React from 'react';
import PageLayout from '../layout/PageLayout';

export default function CalculationsPage() {
    return (
        <PageLayout title="Calculations" kicker="Tools">
            <p>
                Calculation tools and spatial analytics will live here.
            </p>
            <div className="qwc-route-panel">
                <h2>Planned modules</h2>
                <ul>
                    <li>Area and distance calculations</li>
                    <li>Raster statistics by selected geometry</li>
                    <li>Weather and landscape indicator summaries</li>
                </ul>
            </div>
        </PageLayout>
    );
}
