export function sourceLineEndingNormalizationBuildPlugin() {
  return {
    name: 'source-line-ending-normalization',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0].replaceAll('\\\\', '/')
      if (!/\.(?:js|jsx|ts|tsx)$/.test(cleanId)) return null
      if (!code.includes('\r')) return null
      return code.replace(/\r\n?/g, '\n')
    },
  }
}
