import { router, type Method, type VisitOptions } from "@kolektiv/keel"
import { splitProps, type JSX } from "solid-js"

export interface FormProps
  extends Omit<JSX.FormHTMLAttributes<HTMLFormElement>, "action" | "method" | "onError" | "onSubmit">,
    Pick<
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
  children?: JSX.Element
}

/**
 * Form submission through `router.visit`. Serializes the form to `FormData`;
 * `onSuccess` resets the fields when `resetOnSuccess` is set. `on:submit`
 * keeps the native event so `currentTarget` is the form element.
 */
export function Form(props: FormProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    "action",
    "method",
    "resetOnSuccess",
    "replace",
    "preserveScroll",
    "preserveState",
    "headers",
    "force",
    "onBefore",
    "onSuccess",
    "onError",
    "onSubmit",
    "children",
  ])

  function handleSubmit(event: SubmitEvent & { currentTarget: HTMLFormElement }): void {
    local.onSubmit?.(event)
    if (event.defaultPrevented) return
    event.preventDefault()
    const form = event.currentTarget
    void router.visit(local.action, {
      method: local.method ?? "post",
      data: new FormData(form),
      replace: local.replace ?? false,
      preserveScroll: local.preserveScroll ?? false,
      preserveState: local.preserveState ?? true,
      headers: local.headers,
      force: local.force ?? false,
      onBefore: local.onBefore,
      onError: local.onError,
      onSuccess(page) {
        if (local.resetOnSuccess) form.reset()
        local.onSuccess?.(page)
      },
    })
  }

  return (
    <form
      action={local.action}
      method={(local.method ?? "post") as JSX.HTMLFormMethod}
      on:submit={handleSubmit}
      {...rest}
    >
      {local.children}
    </form>
  )
}
