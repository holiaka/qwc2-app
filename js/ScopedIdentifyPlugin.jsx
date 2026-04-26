import IdentifyPlugin from 'qwc2/plugins/Identify';
import ConfigUtils from 'qwc2/utils/ConfigUtils';
import {connect} from 'react-redux';

const BASE_IDENTIFY = IdentifyPlugin;
const TITILER_THEME_IDS = ['titiler-landscape'];
const TITILER_THEME_TITLES = ['titiler landscape', 'titeler landscapes'];
const norm = value => String(value || '').trim().toLowerCase();

function isTitilerTheme(theme) {
    return TITILER_THEME_IDS.includes(norm(theme?.id))
        || TITILER_THEME_IDS.includes(norm(theme?.name))
        || TITILER_THEME_TITLES.includes(norm(theme?.title));
}

export default connect((state) => {
    const explicitIdentify = state.task.id === 'Identify';
    const autoIdentify = state.task.identifyEnabled
        && ConfigUtils.getConfigProp('identifyTool', state.theme.current, 'Identify') === 'Identify';
    return {
        enabled: explicitIdentify || (autoIdentify && !isTitilerTheme(state.theme.current))
    };
}, null, null, {pure: false})(BASE_IDENTIFY);
