import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';

import {addLayer, LayerRole, removeLayer} from 'qwc2/actions/layers';
import {setCurrentTask} from 'qwc2/actions/task';
import ResizeableWindow from 'qwc2/components/ResizeableWindow';

const METEO_PREVIEW_LAYER_PREFIX = 'meteo_preview_';
const METEO_SAVED_LAYER_PREFIX = 'meteo_saved_';
const AUTO_THEME_IDS = ['titiler-landscape'];
const AUTO_THEME_TITLES = ['TiTiler Landscape', 'Titeler landscapes'];
const norm = value => String(value || '').trim().toLowerCase();

const PRODUCT_LABELS = {
    aswdifd_s: 'Diffuse shortwave radiation',
    aswdir_s: 'Direct shortwave radiation',
    relhum_2m: 'Relative humidity 2m',
    sw_down_total: 'Total shortwave radiation',
    t_2m: 'Temperature 2m',
    t_2m_c: 'Temperature 2m, C',
    td_2m: 'Dew point 2m',
    tot_prec: 'Total precipitation',
    u_10m: 'Wind U 10m',
    v_10m: 'Wind V 10m',
    vmax_10m: 'Wind gust 10m',
    wind_dir_10m: 'Wind direction 10m',
    wind_speed_10m: 'Wind speed 10m'
};

const SERIES_CONFIG = {
    t_2m_c: {color: '#c43d2b', label: 'Temperature', type: 'line', unit: 'C'},
    relhum_2m: {color: '#2877b8', label: 'Relative humidity', type: 'line', unit: '%'},
    tot_prec: {color: '#3b8f5b', label: 'Precipitation', type: 'bar', unit: 'mm'},
    wind_speed_10m: {color: '#7353ba', label: 'Wind', type: 'line', unit: 'm/s'}
};

const PRODUCT_RENDERING = {
    relhum_2m: {min: 0, max: 100, unit: '%', colormap: 'turbo'},
    t_2m: {min: 233.15, max: 323.15, unit: 'K', colormap: 'turbo'},
    t_2m_c: {min: -40, max: 50, unit: 'C', colormap: 'turbo'},
    td_2m: {min: 233.15, max: 323.15, unit: 'K', colormap: 'turbo'},
    tot_prec: {min: 0, max: 50, unit: 'mm', colormap: 'turbo'},
    u_10m: {min: -20, max: 20, unit: 'm/s', colormap: 'coolwarm'},
    v_10m: {min: -20, max: 20, unit: 'm/s', colormap: 'coolwarm'},
    vmax_10m: {min: 0, max: 30, unit: 'm/s', colormap: 'turbo'},
    wind_speed_10m: {min: 0, max: 25, unit: 'm/s', colormap: 'turbo'},
    wind_dir_10m: {min: 0, max: 360, unit: 'deg', colormap: 'hsv'},
    aswdir_s: {min: 0, max: 900, unit: 'W/m2', colormap: 'turbo'},
    aswdifd_s: {min: 0, max: 500, unit: 'W/m2', colormap: 'turbo'},
    sw_down_total: {min: 0, max: 1200, unit: 'W/m2', colormap: 'turbo'}
};

const LEGEND_GRADIENTS = {
    coolwarm: 'linear-gradient(90deg, #3b4cc0 0%, #8db0fe 25%, #f7f7f7 50%, #f4987a 75%, #b40426 100%)',
    hsv: 'linear-gradient(90deg, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
    turbo: 'linear-gradient(90deg, #30123b 0%, #4145ab 12%, #4675ed 25%, #1bcfd4 38%, #62fc6b 50%, #d8e219 63%, #f89540 78%, #d93806 90%, #7a0403 100%)'
};

class MeteoRaster extends React.Component {
    static propTypes = {
        active: PropTypes.bool,
        addLayer: PropTypes.func,
        click: PropTypes.object,
        currentTheme: PropTypes.object,
        layers: PropTypes.array,
        map: PropTypes.object,
        removeLayer: PropTypes.func,
        setCurrentTask: PropTypes.func
    };

    canvasRef = React.createRef();
    particles = [];
    windAnimationFrame = null;
    windFetchTimer = null;

    state = {
        items: [],
        loading: false,
        error: null,
        product: 't_2m_c',
        validTime: '',
        timeIndex: 0,
        opacity: 180,
        pointSeries: null,
        pointLoading: false,
        pointError: null,
        rendering: {},
        visible: false,
        windEnabled: true,
        windField: null,
        windLoading: false,
        windError: null
    };

    componentDidMount() {
        if (this.isAutoTheme()) {
            this.startForTheme();
        }
    }

    componentDidUpdate(prevProps, prevState) {
        const wasAutoTheme = this.isAutoTheme(prevProps.currentTheme);
        const isAutoTheme = this.isAutoTheme();
        if (!this.isSameTheme(prevProps.currentTheme, this.props.currentTheme)) {
            if (isAutoTheme) {
                this.startForTheme();
            } else if (wasAutoTheme) {
                this.stopForTheme();
            }
        }
        if (this.props.active && !prevProps.active && this.state.items.length === 0 && !this.state.loading) {
            this.setState({visible: true});
            this.loadItems();
        } else if (this.props.active && !prevProps.active) {
            this.setState({visible: true});
        }
        if (this.props.click && this.props.click !== prevProps.click) {
            this.loadPointSeries(this.props.click);
        }
        if (
            isAutoTheme
            && this.state.items.length > 0
            && (
                prevState.validTime !== this.state.validTime
                || prevState.product !== this.state.product
                || prevState.opacity !== this.state.opacity
                || prevState.rendering !== this.state.rendering
            )
        ) {
            this.replaceSelectedLayer();
        }
        if (
            isAutoTheme
            && this.state.windEnabled
            && this.state.validTime
            && (
                prevState.windEnabled !== this.state.windEnabled
                || prevState.validTime !== this.state.validTime
                || prevProps.map?.bbox?.bounds !== this.props.map?.bbox?.bounds
                || prevProps.map?.size !== this.props.map?.size
            )
        ) {
            this.scheduleWindFieldLoad();
        }
        if (prevState.windEnabled && !this.state.windEnabled) {
            this.stopWindAnimation();
        }
    }

    componentWillUnmount() {
        this.stopWindAnimation();
        if (this.windFetchTimer) {
            clearTimeout(this.windFetchTimer);
        }
    }

    isAutoTheme = themeArg => {
        const theme = themeArg || this.props.currentTheme || {};
        return AUTO_THEME_IDS.includes(norm(theme.id))
            || AUTO_THEME_IDS.includes(norm(theme.name))
            || AUTO_THEME_TITLES.map(norm).includes(norm(theme.title));
    };

    isSameTheme = (left, right) => {
        return (left?.id || left?.name || left?.title) === (right?.id || right?.name || right?.title);
    };

    startForTheme = () => {
        this.setState({visible: true});
        if (this.state.items.length === 0 && !this.state.loading) {
            this.loadItems();
        } else {
            this.replaceSelectedLayer();
        }
    };

    stopForTheme = () => {
        this.stopWindAnimation();
        if (this.windFetchTimer) {
            clearTimeout(this.windFetchTimer);
            this.windFetchTimer = null;
        }
        this.setState({visible: false, windField: null, windLoading: false, windError: null});
        this.removePreviewLayers();
    };

    removePreviewLayers = () => {
        (this.props.layers || [])
            .filter(layer => layer.name?.startsWith(METEO_PREVIEW_LAYER_PREFIX) || layer.id?.startsWith(METEO_PREVIEW_LAYER_PREFIX))
            .forEach(layer => this.props.removeLayer(layer.id));
    };

    loadItems = () => {
        this.setState({loading: true, error: null});
        fetch('/fastapi/meteo/icon/rasters')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                const items = (data.items || [])
                    .filter(item => item?.metadata?.valid_time && item?.raster_url)
                    .sort((a, b) => {
                        const productSort = (a.product || '').localeCompare(b.product || '');
                        if (productSort !== 0) {
                            return productSort;
                        }
                        return new Date(a.metadata.valid_time) - new Date(b.metadata.valid_time);
                    });
                const preferredProduct = this.state.product || 't_2m_c';
                const product = items.some(item => item.product === preferredProduct)
                    ? preferredProduct
                    : (items[0]?.product || '');
                const productTimes = items.filter(item => item.product === product);
                const validTime = this.state.validTime && productTimes.some(item => item.metadata.valid_time === this.state.validTime)
                    ? this.state.validTime
                    : (productTimes[productTimes.length - 1]?.metadata.valid_time || '');
                const rendering = this.defaultRendering(items, this.state.rendering);
                this.setState({
                    items,
                    product,
                    rendering,
                    validTime,
                    timeIndex: Math.max(0, productTimes.findIndex(item => item.metadata.valid_time === validTime)),
                    loading: false
                });
            })
            .catch(error => {
                this.setState({error: error.message, loading: false});
            });
    };

    productItems = () => {
        return this.state.items.filter(item => item.product === this.state.product);
    };

    selectedItem = () => {
        return this.productItems().find(item => item.metadata.valid_time === this.state.validTime);
    };

    setProduct = ev => {
        const product = ev.target.value;
        const productTimes = this.state.items.filter(item => item.product === product);
        const timeIndex = Math.max(0, productTimes.length - 1);
        this.setState({
            product,
            timeIndex,
            validTime: productTimes[timeIndex]?.metadata?.valid_time || ''
        });
    };

    titilerUrl = item => {
        const rendering = this.productRendering(item.product);
        const params = new URLSearchParams({
            url: item.raster_url,
            rescale: `${rendering.min},${rendering.max}`,
            colormap_name: rendering.colormap
        });
        return `/titiler/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?${params.toString()}`;
    };

    productRendering = product => {
        return {
            ...(PRODUCT_RENDERING[product] || {min: 0, max: 1, unit: '', colormap: 'turbo'}),
            ...(this.state.rendering[product] || {})
        };
    };

    defaultRendering = (items, currentRendering = {}) => {
        const next = {...currentRendering};
        [...new Set(items.map(item => item.product))].forEach(product => {
            if (next[product]) {
                return;
            }
            const stats = items
                .filter(item => item.product === product && item.stats)
                .map(item => item.stats);
            if (stats.length === 0) {
                return;
            }
            next[product] = {
                max: Math.max(...stats.map(item => Number(item.max))),
                min: Math.min(...stats.map(item => Number(item.min)))
            };
        });
        return next;
    };

    setRenderingValue = (key, value) => {
        const numeric = Number(value);
        const base = this.productRendering(this.state.product);
        this.setState({
            rendering: {
                ...this.state.rendering,
                [this.state.product]: {
                    max: base.max,
                    min: base.min,
                    [key]: Number.isFinite(numeric) ? numeric : value
                }
            }
        });
    };

    replaceSelectedLayer = () => {
        this.addSelectedLayer({replaceExisting: true});
    };

    addSelectedLayer = ({replaceExisting = false} = {}) => {
        const item = this.selectedItem();
        if (!item) {
            return;
        }

        const prefix = replaceExisting ? METEO_PREVIEW_LAYER_PREFIX : METEO_SAVED_LAYER_PREFIX;
        const baseLayerName = `${prefix}${item.product}_${this.compactTime(item.metadata.valid_time)}`;
        const layerName = replaceExisting
            ? baseLayerName
            : this.uniqueLayerName(baseLayerName);
        const title = `${PRODUCT_LABELS[item.product] || item.product} ${this.formatTime(item.metadata.valid_time)}`;

        if (replaceExisting) {
            (this.props.layers || [])
                .filter(layer => layer.name?.startsWith(METEO_PREVIEW_LAYER_PREFIX) || layer.id?.startsWith(METEO_PREVIEW_LAYER_PREFIX))
                .forEach(layer => this.props.removeLayer(layer.id));
        }

        this.props.addLayer({
            id: layerName,
            name: layerName,
            title,
            type: 'xyz',
            role: LayerRole.USERLAYER,
            url: this.titilerUrl(item),
            projection: 'EPSG:3857',
            tileSize: 256,
            visibility: true,
            opacity: Number(this.state.opacity),
            attribution: {
                Title: 'DWD ICON-EU / TiTiler',
                OnlineResource: null
            }
        });
    };

    uniqueLayerName = baseLayerName => {
        const usedNames = new Set((this.props.layers || []).map(layer => layer.name || layer.id));
        if (!usedNames.has(baseLayerName)) {
            return baseLayerName;
        }
        for (let index = 2; index < 1000; index += 1) {
            const candidate = `${baseLayerName}_${index}`;
            if (!usedNames.has(candidate)) {
                return candidate;
            }
        }
        return `${baseLayerName}_${Date.now()}`;
    };

    compactTime = value => {
        return String(value || '').replace(/[-:T]/g, '').replace(/\+.*/, '').slice(0, 12);
    };

    formatTime = value => {
        if (!value) {
            return '';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return date.toLocaleString('uk-UA', {
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            month: '2-digit',
            timeZone: 'UTC',
            year: 'numeric'
        }) + ' UTC';
    };

    setTimeIndex = value => {
        const times = this.productItems();
        const timeIndex = Number(value);
        this.setState({
            timeIndex,
            validTime: times[timeIndex]?.metadata?.valid_time || ''
        });
    };

    scheduleWindFieldLoad = () => {
        if (this.windFetchTimer) {
            clearTimeout(this.windFetchTimer);
        }
        this.windFetchTimer = setTimeout(this.loadWindField, 350);
    };

    loadWindField = () => {
        const bounds = this.props.map?.bbox?.bounds;
        if (!this.state.validTime || !bounds || bounds.length !== 4) {
            return;
        }
        this.setState({windLoading: true, windError: null});
        fetch('/fastapi/meteo/icon/wind-field', {
            body: JSON.stringify({
                bbox: bounds,
                cols: 34,
                crs: this.props.map?.projection || 'EPSG:3857',
                rows: 22,
                valid_time: this.state.validTime
            }),
            headers: {'Content-Type': 'application/json'},
            method: 'POST'
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                this.setState({windField: data, windLoading: false}, this.startWindAnimation);
            })
            .catch(error => {
                this.setState({windError: error.message, windLoading: false});
            });
    };

    startWindAnimation = () => {
        if (!this.state.windEnabled || !this.state.windField?.points?.length || !this.canvasRef.current) {
            return;
        }
        this.stopWindAnimation(false);
        this.resetParticles();
        const draw = () => {
            this.drawWindFrame();
            this.windAnimationFrame = requestAnimationFrame(draw);
        };
        draw();
    };

    stopWindAnimation = (clear = true) => {
        if (this.windAnimationFrame) {
            cancelAnimationFrame(this.windAnimationFrame);
            this.windAnimationFrame = null;
        }
        if (clear && this.canvasRef.current) {
            const context = this.canvasRef.current.getContext('2d');
            context.clearRect(0, 0, this.canvasRef.current.width, this.canvasRef.current.height);
        }
    };

    resetParticles = () => {
        const field = this.state.windField;
        if (!field?.bbox) {
            this.particles = [];
            return;
        }
        const validPoints = (field.points || []).filter(point => point && Number.isFinite(point.speed));
        this.particles = Array.from({length: 320}, () => this.createParticle(validPoints));
    };

    createParticle = validPoints => {
        const field = this.state.windField;
        const points = validPoints?.length ? validPoints : (field.points || []).filter(point => point && Number.isFinite(point.speed));
        if (points.length === 0) {
            return {age: 999, x: 0, y: 0};
        }
        const [minx, miny, maxx, maxy] = field.bbox;
        const seed = points[Math.floor(Math.random() * points.length)];
        const jitterX = (maxx - minx) / Math.max(1, field.cols - 1) * (Math.random() - 0.5);
        const jitterY = (maxy - miny) / Math.max(1, field.rows - 1) * (Math.random() - 0.5);
        return {
            age: Math.random() * 70,
            x: seed.x + jitterX,
            y: seed.y + jitterY
        };
    };

    windAt = (x, y) => {
        const field = this.state.windField;
        if (!field?.bbox || !field.points?.length) {
            return null;
        }
        const [minx, miny, maxx, maxy] = field.bbox;
        if (x < minx || x > maxx || y < miny || y > maxy) {
            return null;
        }
        const col = Math.max(0, Math.min(field.cols - 1, Math.round((x - minx) / (maxx - minx) * (field.cols - 1))));
        const row = Math.max(0, Math.min(field.rows - 1, Math.round((maxy - y) / (maxy - miny) * (field.rows - 1))));
        return field.points[row * field.cols + col];
    };

    mapToPixel = (x, y, width, height) => {
        const bounds = this.state.windField?.bbox;
        if (!bounds) {
            return null;
        }
        const [minx, miny, maxx, maxy] = bounds;
        return [
            (x - minx) / (maxx - minx) * width,
            (maxy - y) / (maxy - miny) * height
        ];
    };

    resetParticle = particle => {
        const next = this.createParticle();
        particle.x = next.x;
        particle.y = next.y;
        particle.age = next.age;
    };

    drawWindFrame = () => {
        const canvas = this.canvasRef.current;
        const field = this.state.windField;
        if (!canvas || !field?.bbox) {
            return;
        }
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);
            this.resetParticles();
        }
        const context = canvas.getContext('2d');
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.globalCompositeOperation = 'destination-in';
        context.fillStyle = 'rgba(0, 0, 0, 0.965)';
        context.fillRect(0, 0, rect.width, rect.height);
        context.globalCompositeOperation = 'source-over';

        const [minx, miny, maxx, maxy] = field.bbox;
        const xStep = (maxx - minx) * 0.000075;
        const yStep = (maxy - miny) * 0.000075;
        this.particles.forEach(particle => {
            const wind = this.windAt(particle.x, particle.y);
            if (!wind) {
                this.resetParticle(particle);
                return;
            }
            const start = this.mapToPixel(particle.x, particle.y, rect.width, rect.height);
            const nextX = particle.x + wind.u * xStep;
            const nextY = particle.y + wind.v * yStep;
            const end = this.mapToPixel(nextX, nextY, rect.width, rect.height);
            if (!start || !end || particle.age > 100 || nextX < minx || nextX > maxx || nextY < miny || nextY > maxy) {
                this.resetParticle(particle);
                return;
            }
            const alpha = Math.max(0.52, Math.min(0.96, wind.speed / 12));
            context.shadowBlur = 8;
            context.shadowColor = `rgba(0, 245, 255, ${alpha})`;
            context.beginPath();
            context.moveTo(start[0], start[1]);
            context.lineTo(end[0], end[1]);
            context.strokeStyle = `rgba(0, 245, 255, ${alpha})`;
            context.lineWidth = Math.max(2.2, Math.min(5.4, wind.speed / 3.6));
            context.stroke();
            context.shadowBlur = 0;
            context.beginPath();
            context.arc(end[0], end[1], Math.max(1.8, Math.min(4.2, wind.speed / 4.2)), 0, 2 * Math.PI);
            context.fillStyle = `rgba(220, 255, 255, ${Math.min(1, alpha + 0.12)})`;
            context.fill();
            particle.x = nextX;
            particle.y = nextY;
            particle.age += 1;
        });
    };

    loadPointSeries = click => {
        if (!click?.coordinate || click.button !== 0 || !this.isAutoTheme()) {
            return;
        }
        this.setState({pointLoading: true, pointError: null});
        fetch('/fastapi/meteo/icon/timeseries', {
            body: JSON.stringify({
                x: click.coordinate[0],
                y: click.coordinate[1],
                crs: this.props.map?.projection || 'EPSG:3857'
            }),
            headers: {'Content-Type': 'application/json'},
            method: 'POST'
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (!data.has_data) {
                    this.setState({pointLoading: false, pointSeries: null, pointError: 'No weather data at this point'});
                    return;
                }
                this.setState({pointLoading: false, pointSeries: data, pointError: null, visible: true});
            })
            .catch(error => {
                this.setState({pointLoading: false, pointError: error.message});
            });
    };

    renderLegend = () => {
        const rendering = this.productRendering(this.state.product);
        const unit = rendering.unit ? ` ${rendering.unit}` : '';
        return (
            <div style={{display: 'grid', gap: 3, minWidth: 180}}>
                <div style={{
                    background: LEGEND_GRADIENTS[rendering.colormap] || LEGEND_GRADIENTS.turbo,
                    border: '1px solid rgba(0,0,0,0.35)',
                    height: 12
                }} />
                <div style={{display: 'flex', fontSize: 11, justifyContent: 'space-between'}}>
                    <span>{rendering.min}{unit}</span>
                    <span>{rendering.max}{unit}</span>
                </div>
            </div>
        );
    };

    renderChart = (product, values) => {
        const cfg = SERIES_CONFIG[product];
        if (!cfg || !values?.length) {
            return null;
        }
        const width = 330;
        const height = 150;
        const pad = 28;
        const nums = values.map(item => Number(item.value)).filter(value => Number.isFinite(value));
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        const span = max - min || 1;
        const times = values.map(item => new Date(item.time).getTime()).filter(value => Number.isFinite(value));
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        const timeSpan = maxTime - minTime || 1;
        const xForTime = value => pad + ((value - minTime) / timeSpan) * (width - pad * 2);
        const xFor = index => xForTime(new Date(values[index].time).getTime());
        const yFor = value => height - pad - ((Number(value) - min) / span) * (height - pad * 2);
        const path = values.map((item, index) => `${index === 0 ? 'M' : 'L'}${xFor(index)},${yFor(item.value)}`).join(' ');
        const now = Date.now();
        const nowX = now >= minTime && now <= maxTime ? xForTime(now) : null;
        const bars = values.map((item, index) => {
            const barWidth = Math.max(4, (width - pad * 2) / values.length * 0.62);
            const y = yFor(item.value);
            return (
                <rect
                    fill={cfg.color}
                    height={Math.max(1, height - pad - y)}
                    key={`${item.time}-${index}`}
                    opacity="0.72"
                    width={barWidth}
                    x={xFor(index) - barWidth / 2}
                    y={y}
                />
            );
        });
        return (
            <div key={product} style={{border: '1px solid #d4d4d4', borderRadius: 4, padding: 8}}>
                <div style={{display: 'flex', fontSize: 12, fontWeight: 600, justifyContent: 'space-between'}}>
                    <span>{cfg.label}</span>
                    <span>{min.toFixed(1)} - {max.toFixed(1)} {cfg.unit}</span>
                </div>
                <svg height={height} role="img" width="100%" viewBox={`0 0 ${width} ${height}`}>
                    <line stroke="#d0d0d0" x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} />
                    <line stroke="#d0d0d0" x1={pad} x2={pad} y1={pad} y2={height - pad} />
                    {nowX !== null ? (
                        <React.Fragment>
                            <line stroke="#111" strokeDasharray="4 3" x1={nowX} x2={nowX} y1={pad} y2={height - pad} />
                            <text fill="#111" fontSize="10" x={nowX + 3} y={pad + 10}>now</text>
                        </React.Fragment>
                    ) : null}
                    {cfg.type === 'bar' ? bars : <path d={path} fill="none" stroke={cfg.color} strokeWidth="2.4" />}
                    {cfg.type === 'line' ? values.map((item, index) => (
                        <circle cx={xFor(index)} cy={yFor(item.value)} fill={cfg.color} key={`${item.time}-${index}`} r="2.5" />
                    )) : null}
                    <text fill="#555" fontSize="10" x={pad} y={18}>{max.toFixed(1)}</text>
                    <text fill="#555" fontSize="10" x={pad} y={height - 7}>{min.toFixed(1)}</text>
                </svg>
                <div style={{display: 'grid', fontSize: 11, gap: 3, gridTemplateColumns: '1fr auto', maxHeight: 86, overflow: 'auto'}}>
                    {values.map((item, index) => (
                        <React.Fragment key={`${item.time}-${index}`}>
                            <span>{this.formatTime(item.time)}</span>
                            <strong>{Number(item.value).toFixed(2)} {cfg.unit}</strong>
                        </React.Fragment>
                    ))}
                </div>
            </div>
        );
    };

    renderPointSeries = () => {
        if (this.state.pointLoading) {
            return <div>Loading point weather...</div>;
        }
        if (this.state.pointError) {
            return <div style={{color: '#8a5a00'}}>{this.state.pointError}</div>;
        }
        if (!this.state.pointSeries) {
            return <div style={{color: '#666'}}>Click inside the weather raster area to load point charts.</div>;
        }
        const series = this.state.pointSeries.series || {};
        return (
            <div style={{display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))'}}>
                {Object.keys(SERIES_CONFIG).map(product => this.renderChart(product, series[product] || []))}
            </div>
        );
    };

    renderWindCanvas = () => {
        if (!this.state.windEnabled || !this.isAutoTheme()) {
            return null;
        }
        return (
            <canvas
                key="MeteoWindCanvas"
                ref={this.canvasRef}
                style={{
                    bottom: 'var(--bottombar-height, 0px)',
                    height: 'calc(100vh - var(--topbar-height, 0px) - var(--bottombar-height, 0px))',
                    left: 0,
                    pointerEvents: 'none',
                    position: 'fixed',
                    right: 0,
                    top: 'var(--topbar-height, 0px)',
                    width: '100vw',
                    zIndex: 9
                }}
            />
        );
    };

    renderBody = () => {
        const products = [...new Set(this.state.items.map(item => item.product))];
        const times = this.productItems();
        const wrongTheme = !this.isAutoTheme();
        const selectedLabel = this.formatTime(this.state.validTime);
        const rendering = this.productRendering(this.state.product);

        return (
            <div style={{display: 'grid', gap: 10, minWidth: 780, padding: 8}}>
                {wrongTheme ? (
                    <div style={{color: '#8a5a00'}}>Select theme "TiTiler Landscape" for this tool.</div>
                ) : null}
                <div style={{alignItems: 'end', display: 'grid', gap: 8, gridTemplateColumns: '170px 1fr 84px 84px 84px 110px 190px'}}>
                    <label>
                        Parameter
                        <select onChange={this.setProduct} style={{display: 'block', width: '100%'}} value={this.state.product}>
                            {products.map(product => (
                                <option key={product} value={product}>{PRODUCT_LABELS[product] || product}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Date / time: {selectedLabel}
                        <input
                            disabled={times.length === 0}
                            max={Math.max(0, times.length - 1)}
                            min="0"
                            onChange={ev => this.setTimeIndex(ev.target.value)}
                            step="1"
                            style={{display: 'block', width: '100%'}}
                            type="range"
                            value={this.state.timeIndex}
                        />
                    </label>
                    <label>
                        Opacity
                        <input
                            max="255"
                            min="0"
                            onChange={ev => this.setState({opacity: ev.target.value})}
                            style={{display: 'block', width: '100%'}}
                            type="range"
                            value={this.state.opacity}
                        />
                    </label>
                    <label>
                        Min
                        <input
                            onChange={ev => this.setRenderingValue('min', ev.target.value)}
                            step="any"
                            style={{display: 'block', width: '100%'}}
                            type="number"
                            value={rendering.min}
                        />
                    </label>
                    <label>
                        Max
                        <input
                            onChange={ev => this.setRenderingValue('max', ev.target.value)}
                            step="any"
                            style={{display: 'block', width: '100%'}}
                            type="number"
                            value={rendering.max}
                        />
                    </label>
                    <button disabled={!this.selectedItem()} onClick={() => this.addSelectedLayer()} type="button">
                        Add layer
                    </button>
                    {this.renderLegend()}
                </div>
                <div style={{alignItems: 'center', display: 'flex', gap: 8}}>
                    <button onClick={this.loadItems} type="button">
                        {this.state.loading ? 'Loading...' : 'Refresh'}
                    </button>
                    <label style={{alignItems: 'center', display: 'flex', gap: 4}}>
                        <input
                            checked={this.state.windEnabled}
                            onChange={ev => this.setState({windEnabled: ev.target.checked})}
                            type="checkbox"
                        />
                        Wind animation
                    </label>
                    <span>{times.length ? `${times.length} times available` : 'No rasters available'}</span>
                    {this.state.windLoading ? <span>Loading wind...</span> : null}
                    {this.state.windField?.points ? (
                        <span>
                            {this.state.windField.points.filter(point => point && Number.isFinite(point.speed)).length} wind vectors
                        </span>
                    ) : null}
                    {this.state.windError ? <span style={{color: '#b00020'}}>{this.state.windError}</span> : null}
                    {this.state.error ? <span style={{color: '#b00020'}}>{this.state.error}</span> : null}
                </div>
                {this.renderPointSeries()}
            </div>
        );
    };

    render() {
        if (!this.state.visible || (!this.props.active && !this.isAutoTheme())) {
            return null;
        }
        return [
            this.renderWindCanvas(),
            <ResizeableWindow
                dockable
                icon="rasterexport"
                initialHeight={560}
                initialWidth={900}
                initialX={12}
                initialY={72}
                key="MeteoRasterWindow"
                maximizeable
                minimizeable
                onClose={() => {
                    this.setState({visible: false});
                    if (this.props.active) {
                        this.props.setCurrentTask(null);
                    }
                }}
                title="Meteo raster"
                visible
            >
                {this.renderBody()}
            </ResizeableWindow>
        ];
    }
}

export default connect(state => ({
    active: state.task.id === 'MeteoRaster',
    click: state.map.click,
    currentTheme: state.theme.current,
    layers: state.layers.flat,
    map: state.map
}), {
    addLayer,
    removeLayer,
    setCurrentTask
})(MeteoRaster);
