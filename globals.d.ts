declare module '*.css' {
  export interface Styles {
    [className: string]: string;
  }

  const styles: Styles;
  export default styles;
}