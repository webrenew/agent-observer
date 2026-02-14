import defaultMdxComponents from "fumadocs-ui/mdx";

type MDXComponents = typeof defaultMdxComponents;

export function useMDXComponents(
  components?: Partial<MDXComponents>
): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
  } as MDXComponents;
}

