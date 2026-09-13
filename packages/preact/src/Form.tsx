import { router, type Method, type VisitOptions } from "@kolektiv/keel"
import type { ComponentChildren, JSX } from "preact"

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
  onSubmit?: (event: JSX.TargetedSubmitEvent<HTMLFormElement>) => void
  children?: ComponentChildren
}

/**
 * Form submission through `router.visit`. Serializes the form to `FormData`;
 * `onSuccess` resets the fields when `resetOnSuccess` is set.
 */
export function Form({
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
  children,
  ...rest
}: FormProps) {
  function handleSubmit(event: JSX.TargetedSubmitEvent<HTMLFormElement>) {
    onSubmit?.(event)
    if (event.defaultPrevented) return
    event.preventDefault()
    const form = event.currentTarget
    void router.visit(action, {
      method,
      data: new FormData(form),
      preserveScroll,
      preserveState,
      replace,
      headers,
      force,
      onBefore,
      onError,
      onSuccess(page) {
        if (resetOnSuccess) form.reset()
        onSuccess?.(page)
      },
    })
  }

  return (
    <form action={action} method={method} onSubmit={handleSubmit} {...rest}>
      {children}
    </form>
  )
}
