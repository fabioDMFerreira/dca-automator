export default function(timeout: number): Promise<any> {
  return new Promise((accept) => {
    setTimeout(accept, timeout)
  })
}
