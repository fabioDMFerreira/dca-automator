class Console {
  log(message?: any, ...params: any[]) {
    if (process.env.DEBUG) {
      console.log(message, ...params)
    }
  }

  warn(message?: any, ...params: any[]) {
    if (process.env.DEBUG) {
      console.warn(message, ...params)
    }
  }
}

export default new Console();
