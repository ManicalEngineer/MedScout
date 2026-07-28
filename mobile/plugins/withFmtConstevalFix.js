const { withPodfile } = require('@expo/config-plugins');

// fmt 11.0.2 (pinned by react-native) fails to compile under recent Xcode/Clang:
// every `FMT_STRING(...)` call in format-inl.h trips a consteval false-positive
// ("call to consteval function ... is not a constant expression").
// Stripping the FMT_STRING wrapper is behaviorally identical (it only skips a
// compile-time format-string check on fmt's own internal literals) and lets
// the pod compile. Patched post-install since ios/Pods is regenerated on
// every `pod install` / `expo prebuild`.
const PATCH_SNIPPET = `
    fmt_format_inl = File.join(__dir__, 'Pods/fmt/include/fmt/format-inl.h')
    if File.exist?(fmt_format_inl)
      contents = File.read(fmt_format_inl)
      patched = contents.gsub(/FMT_STRING\\((".*?")\\)/, '\\\\1')
      File.write(fmt_format_inl, patched) if patched != contents
    end
`;

function withFmtConstevalFix(config) {
  return withPodfile(config, (config) => {
    const { contents } = config.modResults;

    if (contents.includes('fmt_format_inl')) {
      return config;
    }

    const marker = 'react_native_post_install(';
    const markerIndex = contents.indexOf(marker);
    if (markerIndex === -1) {
      throw new Error(
        'withFmtConstevalFix: could not find react_native_post_install( in Podfile to patch'
      );
    }

    // Insert right after the matching close of the react_native_post_install(...) call.
    let depth = 0;
    let i = markerIndex + marker.length - 1; // start at the '('
    for (; i < contents.length; i++) {
      if (contents[i] === '(') depth++;
      if (contents[i] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    const insertAt = contents.indexOf('\n', i) + 1;

    config.modResults.contents =
      contents.slice(0, insertAt) + PATCH_SNIPPET + contents.slice(insertAt);

    return config;
  });
}

module.exports = withFmtConstevalFix;
