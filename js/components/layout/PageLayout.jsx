import React from 'react';

export default function PageLayout({children, kicker, title}) {
    return (
        <main className="qwc-route-page">
            <nav className="qwc-route-nav" aria-label="Main navigation">
                <a href="/maps">Maps</a>
                <a href="/about">About</a>
                <a href="/calculations">Calculations</a>
                <a href="/registration">Registration</a>
                <a href="/log-in">Log in</a>
            </nav>
            <section className="qwc-route-content">
                {kicker ? <div className="qwc-route-kicker">{kicker}</div> : null}
                <h1>{title}</h1>
                {children}
            </section>
        </main>
    );
}
