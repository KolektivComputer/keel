import { router, type Method, type VisitOptions } from "@kolektiv/keel"
import { html, type TemplateResult } from "lit"

export interface FormOptions
  extends Pick<
    VisitOptions,
    | "replace"
    | "preserveScroll"
    | "preserveState"
    | "headers"
    | "force"
    | "onBefore"
    | "onSuccess"
    | "onError"
  > {
  action: string
  method?: Method
  resetOnSuccess?: boolean
  onSubmit?: (event: SubmitEvent) => void
}

/**
 * Form submission through `router.visit`, as a template helper rather than a
 * custom element: a shadow-DOM `<form>` cannot own slotted light-DOM
 * controls, so the helper renders the real `<form>` in the page's tree and
 * native validation, `FormData`, and `reset()` all keep working.
 *
 * ```ts
 * form({ action: "/notes", method: "post", resetOnSuccess: true },
 *   html`<input name="body" />`)
 * ```
 */
export function form(
  options: FormOptions,
  children: unknown,
): TemplateResult<1> {
  const {
    action,
    method = "post",
    preserveScroll = false,
    preserveState = true,
    replace = false,
    resetOnSuccess = false,
    headers,
    force = false,
    onBefore,
    onSuccess,
    onError,
    onSubmit,
  } = options

  const submit = (event: SubmitEvent): void => {
    onSubmit?.(event)
    if (event.defaultPrevented) return
    event.preventDefault()
    const element = event.currentTarget as HTMLFormElement
    void router.visit(action, {
      method,
      data: new FormData(element),
      preserveScroll,
      preserveState,
      replace,
      headers,
      force,
      onBefore,
      onError,
      onSuccess(page) {
        if (resetOnSuccess) element.reset()
        onSuccess?.(page)
      },
    })
  }

  return html`<form action=${action} method=${method} @submit=${submit}>${children}</form>`
}
